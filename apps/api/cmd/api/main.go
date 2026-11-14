// Comando api: levanta el backend de Facti (por defecto en el puerto 4000).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"facti/api/internal/arranque"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	h, cfg, err := arranque.Armar(log, true)
	if err != nil {
		log.Error("no se pudo armar la API", "error", err)
		os.Exit(1)
	}
	if cfg.EnvCargado == "" {
		log.Warn("no se encontró .env: copiá .env.example a .env en la raíz del repo para conectar con ARCA")
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Puerto),
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()
	go func() {
		<-ctx.Done()
		// Deja terminar las emisiones en curso antes de cerrar.
		apagar, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancelar()
		_ = srv.Shutdown(apagar)
	}()

	log.Info("Facti API escuchando", "url", fmt.Sprintf("http://localhost:%d", cfg.Puerto), "entorno", cfg.Entorno)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("no se pudo levantar la API", "error", err)
		os.Exit(1)
	}
}
