package cuit

import "testing"

func TestValidar(t *testing.T) {
	validos := []string{"20111111112", "20-11111111-2", "20123456786", "30500010912"}
	for _, c := range validos {
		if !Validar(c) {
			t.Errorf("%s tendría que ser válido", c)
		}
	}
	invalidos := []string{"20111111113", "2011111111", "abc", ""}
	for _, c := range invalidos {
		if Validar(c) {
			t.Errorf("%s tendría que ser inválido", c)
		}
	}
}

func TestFormatear(t *testing.T) {
	if got := Formatear("20111111112"); got != "20-11111111-2" {
		t.Errorf("Formatear = %s", got)
	}
	if got := Formatear("123"); got != "123" {
		t.Errorf("un CUIT incompleto queda igual, dio %s", got)
	}
}
