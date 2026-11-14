package demo

import (
	"context"
	"testing"

	"facti/api/internal/cuit"
	"facti/api/internal/datos"
)

func TestCuentaDePrueba(t *testing.T) {
	m, err := Datos(3)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	c, err := m.CuentaDeUsuario(ctx, Usuario.ID, Usuario.Email, 3)
	if err != nil {
		t.Fatal(err)
	}
	if !cuit.Validar(c.Cuit) {
		t.Errorf("el CUIT de prueba tiene que ser válido: %s", c.Cuit)
	}
	p, err := m.ListarComprobantes(ctx, c.ID, datos.Filtro{})
	if err != nil || p.Total != 10 {
		t.Fatalf("tiene que haber 10 facturas de ejemplo, hay %d (%v)", p.Total, err)
	}
	cls, _ := m.ListarClientes(ctx, c.ID, "")
	for _, cl := range cls {
		if !cuit.Validar(cl.DocNro) {
			t.Errorf("CUIT de cliente inválido: %s", cl.DocNro)
		}
	}
}

func TestSoloAceptaElTokenDeDemo(t *testing.T) {
	if _, err := (Autenticador{}).Verificar(context.Background(), "otro"); err == nil {
		t.Error("un token que no es el de demo tiene que rechazarse")
	}
	u, err := (Autenticador{}).Verificar(context.Background(), Token)
	if err != nil || u.ID != Usuario.ID {
		t.Errorf("el token de demo tiene que entrar: %v %v", u, err)
	}
}
