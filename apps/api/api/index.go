// Package handler es la función de Vercel: todas las rutas de la API pasan por acá
// (vercel.json reescribe /* a /api/index). Arma el handler una sola vez por instancia.
package handler

import (
	"log/slog"
	"net/http"
	"os"
	"sync"

	"facti/api/internal/arranque"
)

var (
	una   sync.Once
	h     http.Handler
	fallo error
)

// Handler atiende cada pedido.
func Handler(w http.ResponseWriter, r *http.Request) {
	una.Do(func() {
		log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
		h, _, fallo = arranque.Armar(log, false)
	})
	if fallo != nil {
		http.Error(w, `{"error":"configuracion","mensaje":"La API no pudo arrancar: `+fallo.Error()+`"}`, http.StatusServiceUnavailable)
		return
	}
	h.ServeHTTP(w, r)
}
