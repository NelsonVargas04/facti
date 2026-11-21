package datos

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"os"
	"testing"
	"time"
)

func TestRecurrentes(t *testing.T) {
	t.Run("memoria", func(t *testing.T) { probarRecurrentes(t, NuevaMemoria()) })
	t.Run("postgres", func(t *testing.T) {
		url := os.Getenv("TEST_DATABASE_URL")
		if url == "" {
			t.Skip("TEST_DATABASE_URL no está definida")
		}
		ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancelar()
		p, err := Conectar(ctx, url)
		if err != nil {
			t.Fatal(err)
		}
		defer p.Cerrar()
		probarRecurrentes(t, p)
	})
}

func TestSiguienteFecha(t *testing.T) {
	ar := time.FixedZone("ART", -3*3600)
	casos := []struct {
		desde time.Time
		dia   int
		want  string
	}{
		{time.Date(2026, 11, 17, 10, 0, 0, 0, ar), 1, "2026-12-01"},
		{time.Date(2026, 12, 3, 10, 0, 0, 0, ar), 15, "2027-01-15"},
		{time.Date(2027, 1, 31, 10, 0, 0, 0, ar), 28, "2027-02-28"},
		{time.Date(2027, 1, 31, 10, 0, 0, 0, ar), 40, "2027-02-28"},
	}
	for _, c := range casos {
		if got := SiguienteFecha(c.desde, c.dia); got != c.want {
			t.Errorf("SiguienteFecha(%s, %d) = %s, quería %s", c.desde.Format("2006-01-02"), c.dia, got, c.want)
		}
	}
}

func probarRecurrentes(t *testing.T, d Datos) {
	ctx := context.Background()
	uuid := func() string {
		return fmt.Sprintf("%08x-%04x-4%03x-a%03x-%012x", rand.Uint32(), rand.IntN(1<<16), rand.IntN(1<<12), rand.IntN(1<<12), rand.Int64N(1<<48))
	}
	c, err := d.CuentaDeUsuario(ctx, uuid(), "rec@ejemplo.com", 1)
	if err != nil {
		t.Fatal(err)
	}
	otra, _ := d.CuentaDeUsuario(ctx, uuid(), "otra-rec@ejemplo.com", 1)

	if rs, err := d.ListarRecurrentes(ctx, c.ID); err != nil || len(rs) != 0 {
		t.Fatalf("sin recurrentes: %v %v", rs, err)
	}
	r := Recurrente{Cliente: "ESTUDIO LUMEN SRL", Total: 85000, Plantilla: []byte(`{"concepto":2,"items":[{"descripcion":"Diseño"}]}`), Dia: 1, Proxima: "2026-12-01", Activa: true}
	if err := d.CrearRecurrente(ctx, c.ID, &r, 0); err != nil || r.ID == 0 {
		t.Fatalf("crear: %+v %v", r, err)
	}
	auto := Recurrente{Cliente: "CAFÉ NORTE SAS", Total: 40000, Plantilla: []byte(`{"concepto":1}`), Dia: 10, Proxima: "2026-11-10", Automatica: true, Activa: true}
	if err := d.CrearRecurrente(ctx, c.ID, &auto, 0); err != nil {
		t.Fatal(err)
	}

	// Con límite: la cuenta ya tiene 2, con máximo 2 no entra otra.
	extra := Recurrente{Cliente: "X", Plantilla: []byte(`{}`), Dia: 2, Proxima: "2026-12-02", Activa: true}
	if err := d.CrearRecurrente(ctx, c.ID, &extra, 2); !errors.Is(err, ErrLimiteRecurrentes) {
		t.Fatalf("límite: %v", err)
	}

	rs, err := d.ListarRecurrentes(ctx, c.ID)
	if err != nil || len(rs) != 2 || rs[0].ID != auto.ID {
		t.Fatalf("listar (por próxima fecha): %+v %v", rs, err)
	}
	if rs, _ := d.ListarRecurrentes(ctx, otra.ID); len(rs) != 0 {
		t.Fatal("otra cuenta no ve las recurrentes")
	}
	if _, err := d.VerRecurrente(ctx, otra.ID, r.ID); !errors.Is(err, ErrNoEncontrado) {
		t.Fatalf("ver de otra cuenta: %v", err)
	}
	v, err := d.VerRecurrente(ctx, c.ID, r.ID)
	if err != nil || v.Cliente != "ESTUDIO LUMEN SRL" || v.Total != 85000 || v.Dia != 1 || string(v.Plantilla) == "" {
		t.Fatalf("ver: %+v %v", v, err)
	}

	// Automáticas vencidas: solo la de Café Norte (activa, automática y con fecha pasada).
	venc, err := d.AutomaticasVencidas(ctx, "2026-11-17")
	encontrada := false
	for _, x := range venc {
		if x.ID == auto.ID && x.CuentaID == c.ID {
			encontrada = true
		}
		if x.ID == r.ID {
			t.Fatal("la de confirmar no es automática")
		}
	}
	if err != nil || !encontrada {
		t.Fatalf("automáticas vencidas: %+v %v", venc, err)
	}

	// Emitir la avanza un mes; un error se guarda y se limpia con la próxima emisión.
	if err := d.RegistrarErrorRecurrente(ctx, c.ID, auto.ID, "ARCA no respondió"); err != nil {
		t.Fatal(err)
	}
	if v, _ := d.VerRecurrente(ctx, c.ID, auto.ID); v.UltimoError != "ARCA no respondió" {
		t.Fatalf("error: %+v", v)
	}
	cmp := Comprobante{Tipo: 11, PuntoVenta: 1, Numero: rand.Int64N(1 << 40), Fecha: "2026-11-17", Concepto: 1, Moneda: "PES", Cotizacion: 1, Total: 40000, Neto: 40000,
		CAE: "1", CAEVto: "2026-11-27", Receptor: Receptor{DocTipo: 99, DocNro: "0"}, Cobro: Pendiente}
	if err := d.GuardarComprobante(ctx, c.ID, &cmp); err != nil {
		t.Fatal(err)
	}
	if err := d.RegistrarEmisionRecurrente(ctx, c.ID, auto.ID, cmp.ID, "2026-11-17", "2026-12-10"); err != nil {
		t.Fatal(err)
	}
	v, _ = d.VerRecurrente(ctx, c.ID, auto.ID)
	if v.Proxima != "2026-12-10" || v.UltimaEmision != "2026-11-17" || v.UltimoComprobanteID == nil || *v.UltimoComprobanteID != cmp.ID || v.UltimoError != "" {
		t.Fatalf("después de emitir: %+v", v)
	}

	// Pausar y cambiar a "confirmar": deja de ser automática vencida.
	v.Activa, v.Automatica, v.Dia, v.Proxima = false, false, 5, "2026-12-05"
	if v2, err := d.ActualizarRecurrente(ctx, c.ID, v); err != nil || v2.Activa || v2.Automatica || v2.Dia != 5 || v2.Proxima != "2026-12-05" {
		t.Fatalf("actualizar: %+v %v", v2, err)
	}
	if _, err := d.ActualizarRecurrente(ctx, otra.ID, v); !errors.Is(err, ErrNoEncontrado) {
		t.Fatalf("actualizar de otra cuenta: %v", err)
	}

	if err := d.BorrarRecurrente(ctx, otra.ID, r.ID); !errors.Is(err, ErrNoEncontrado) {
		t.Fatalf("borrar de otra cuenta: %v", err)
	}
	if err := d.BorrarRecurrente(ctx, c.ID, r.ID); err != nil {
		t.Fatal(err)
	}
	if rs, _ := d.ListarRecurrentes(ctx, c.ID); len(rs) != 1 {
		t.Fatalf("después de borrar: %+v", rs)
	}
}
