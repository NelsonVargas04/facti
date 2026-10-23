package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type proyecto struct {
	srv      *httptest.Server
	clave    *ecdsa.PrivateKey
	lecturas atomic.Int32
}

func nuevoProyecto(t *testing.T) *proyecto {
	t.Helper()
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	p := &proyecto{clave: k}
	p.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		p.lecturas.Add(1)
		enc := func(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "clave-1", "kty": "EC", "crv": "P-256", "alg": "ES256",
			"x": enc(k.PublicKey.X.FillBytes(make([]byte, 32))), "y": enc(k.PublicKey.Y.FillBytes(make([]byte, 32))),
		}}})
	}))
	t.Cleanup(p.srv.Close)
	return p
}

func (p *proyecto) token(t *testing.T, cambiar func(jwt.MapClaims)) string {
	t.Helper()
	c := jwt.MapClaims{
		"iss": p.srv.URL + "/auth/v1", "aud": "authenticated", "sub": "8f1c2b6e-1111-4c5d-9e2f-000000000001",
		"email": "lucia@ejemplo.com", "role": "authenticated", "exp": time.Now().Add(time.Hour).Unix(),
	}
	if cambiar != nil {
		cambiar(c)
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, c)
	tok.Header["kid"] = "clave-1"
	s, err := tok.SignedString(p.clave)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestVerificarES256ConJWKS(t *testing.T) {
	p := nuevoProyecto(t)
	v := NuevoSupabase(p.srv.URL, "")
	u, err := v.Verificar(context.Background(), p.token(t, nil))
	if err != nil {
		t.Fatal(err)
	}
	if u.ID != "8f1c2b6e-1111-4c5d-9e2f-000000000001" || u.Email != "lucia@ejemplo.com" {
		t.Errorf("usuario: %+v", u)
	}
	// Las claves quedan en caché.
	if _, err := v.Verificar(context.Background(), p.token(t, nil)); err != nil || p.lecturas.Load() != 1 {
		t.Errorf("tenía que usar la caché del JWKS: %v, %d lecturas", err, p.lecturas.Load())
	}
}

func TestRechazos(t *testing.T) {
	p := nuevoProyecto(t)
	v := NuevoSupabase(p.srv.URL, "")
	casos := map[string]string{
		"vencido":        p.token(t, func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Hour).Unix() }),
		"otro proyecto":  p.token(t, func(c jwt.MapClaims) { c["iss"] = "https://otro.supabase.co/auth/v1" }),
		"clave anónima":  p.token(t, func(c jwt.MapClaims) { c["role"] = "anon"; delete(c, "sub") }),
		"otra audiencia": p.token(t, func(c jwt.MapClaims) { c["aud"] = "service" }),
		"basura":         "no.es.jwt",
	}
	otra, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	falsa := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"iss": p.srv.URL + "/auth/v1", "aud": "authenticated", "sub": "x", "role": "authenticated", "exp": time.Now().Add(time.Hour).Unix()})
	falsa.Header["kid"] = "clave-1"
	casos["firmado con otra clave"], _ = falsa.SignedString(otra)

	for nombre, tok := range casos {
		if _, err := v.Verificar(context.Background(), tok); !errors.Is(err, ErrSinSesion) {
			t.Errorf("%s: se esperaba ErrSinSesion, vino %v", nombre, err)
		}
	}
}

func TestHS256Legado(t *testing.T) {
	p := nuevoProyecto(t)
	claims := jwt.MapClaims{"iss": p.srv.URL + "/auth/v1", "aud": "authenticated", "sub": "u-1", "role": "authenticated", "exp": time.Now().Add(time.Hour).Unix()}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("secreto-legado"))

	if _, err := NuevoSupabase(p.srv.URL, "").Verificar(context.Background(), tok); err == nil {
		t.Error("sin secreto configurado no tiene que aceptar HS256")
	}
	if u, err := NuevoSupabase(p.srv.URL, "secreto-legado").Verificar(context.Background(), tok); err != nil || u.ID != "u-1" {
		t.Errorf("HS256 con secreto: %+v %v", u, err)
	}
}
