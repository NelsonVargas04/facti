// Package cuit valida y formatea CUIT/CUIL.
package cuit

import "strings"

var pesos = [10]int{5, 4, 3, 2, 7, 6, 5, 4, 3, 2}

// Limpiar deja solo los dígitos.
func Limpiar(c string) string {
	var b strings.Builder
	for _, r := range c {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Validar revisa el dígito verificador (módulo 11).
func Validar(c string) bool {
	c = Limpiar(c)
	if len(c) != 11 {
		return false
	}
	suma := 0
	for i, p := range pesos {
		suma += p * int(c[i]-'0')
	}
	dv := 11 - suma%11
	if dv == 11 {
		dv = 0
	}
	if dv == 10 {
		return false
	}
	return dv == int(c[10]-'0')
}

// Formatear convierte 20123456789 en 20-12345678-9.
func Formatear(c string) string {
	l := Limpiar(c)
	if len(l) != 11 {
		return c
	}
	return l[:2] + "-" + l[2:10] + "-" + l[10:]
}
