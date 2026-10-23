// Package auth valida las sesiones de Supabase Auth (Google o email) que manda la web.
package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Usuario autenticado.
type Usuario struct {
	ID    string // uuid de Supabase Auth
	Email string
}

// ErrSinSesion es un token ausente, vencido o inválido. Se traduce a HTTP 401.
var ErrSinSesion = errors.New("sesión inválida o vencida")

// Supabase verifica los tokens de acceso de un proyecto de Supabase.
// Los proyectos nuevos firman con claves asimétricas (ES256/RS256) publicadas en el JWKS;
// los viejos con un secreto compartido (HS256), que se puede pasar como respaldo.
type Supabase struct {
	url     string
	secreto []byte
	http    *http.Client

	mu            sync.Mutex
	claves        map[string]any
	leidasEn      time.Time
	ultimoIntento time.Time
}

// NuevoSupabase recibe la URL del proyecto (https://xxxx.supabase.co) y, opcionalmente, el JWT secret legado.
func NuevoSupabase(url, secreto string) *Supabase {
	return &Supabase{
		url:     strings.TrimRight(url, "/"),
		secreto: []byte(secreto),
		http:    &http.Client{Timeout: 10 * time.Second},
		claves:  map[string]any{},
	}
}

// Verificar valida el token y devuelve el usuario.
func (s *Supabase) Verificar(ctx context.Context, token string) (Usuario, error) {
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() == "HS256" {
			if len(s.secreto) == 0 {
				return nil, errors.New("token HS256 sin SUPABASE_JWT_SECRET configurado")
			}
			return s.secreto, nil
		}
		kid, _ := t.Header["kid"].(string)
		return s.clave(ctx, kid)
	},
		jwt.WithValidMethods([]string{"ES256", "RS256", "HS256"}),
		jwt.WithIssuer(s.url+"/auth/v1"),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return Usuario{}, fmt.Errorf("%w: %v", ErrSinSesion, err)
	}
	sub, _ := claims["sub"].(string)
	rol, _ := claims["role"].(string)
	// La clave anónima de Supabase también es un JWT válido, pero no es un usuario.
	if sub == "" || rol != "authenticated" {
		return Usuario{}, fmt.Errorf("%w: el token no es de un usuario", ErrSinSesion)
	}
	email, _ := claims["email"].(string)
	return Usuario{ID: sub, Email: email}, nil
}

// clave devuelve la clave pública del kid, leyendo el JWKS si hace falta.
func (s *Supabase) clave(ctx context.Context, kid string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if k, ok := s.claves[kid]; ok && time.Since(s.leidasEn) < time.Hour {
		return k, nil
	}
	// Si el kid no está (Supabase rotó las claves) se vuelve a leer, pero no más de una vez cada 30 s.
	if time.Since(s.ultimoIntento) > 30*time.Second {
		s.ultimoIntento = time.Now()
		if claves, err := s.leerJWKS(ctx); err == nil {
			s.claves, s.leidasEn = claves, time.Now()
		} else if len(s.claves) == 0 {
			return nil, err
		}
	}
	if k, ok := s.claves[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("clave %q desconocida", kid)
}

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (s *Supabase) leerJWKS(ctx context.Context) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url+"/auth/v1/.well-known/jwks.json", nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer las claves de Supabase: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claves de Supabase: HTTP %d", resp.StatusCode)
	}
	var cuerpo struct {
		Keys []jwk `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&cuerpo); err != nil {
		return nil, err
	}
	claves := map[string]any{}
	for _, k := range cuerpo.Keys {
		pub, err := k.publica()
		if err == nil {
			claves[k.Kid] = pub
		}
	}
	return claves, nil
}

func b64(s string) (*big.Int, error) {
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(b), nil
}

func (k jwk) publica() (any, error) {
	switch k.Kty {
	case "EC":
		if k.Crv != "P-256" {
			return nil, fmt.Errorf("curva %s no soportada", k.Crv)
		}
		x, err := b64(k.X)
		if err != nil {
			return nil, err
		}
		y, err := b64(k.Y)
		if err != nil {
			return nil, err
		}
		return &ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}, nil
	case "RSA":
		n, err := b64(k.N)
		if err != nil {
			return nil, err
		}
		e, err := b64(k.E)
		if err != nil {
			return nil, err
		}
		return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
	}
	return nil, fmt.Errorf("tipo de clave %s no soportado", k.Kty)
}
