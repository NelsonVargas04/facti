package servidor

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestDecodificarPEM(t *testing.T) {
	pem := "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n"
	casos := map[string]string{
		"tal cual":       pem,
		"con \n escrito": strings.ReplaceAll(pem, "\n", `\n`),
		"en base64":      base64.StdEncoding.EncodeToString([]byte(pem)),
	}
	for nombre, v := range casos {
		b, err := decodificarPEM("X", v)
		if err != nil || !strings.Contains(string(b), "-----BEGIN CERTIFICATE-----\nAAAA\n") {
			t.Errorf("%s: vino %q %v", nombre, b, err)
		}
	}
	if _, err := decodificarPEM("X", "no es un pem"); err == nil {
		t.Error("un valor que no es PEM tiene que dar error")
	}
}
