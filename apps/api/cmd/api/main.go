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

	"facti/api/internal/config"
	"facti/api/internal/servidor"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := config.Cargar()

	if cfg.EnvCargado != "" {
		log.Info("configuración leída", "env", cfg.EnvCargado)
	} else {
		log.Warn("no se encontró .env: copiá .env.example a .env en la raíz del repo para conectar con ARCA")
	}
	if cfg.Entorno == "produccion" {
		log.Warn("ATENCIÓN: ARCA en PRODUCCIÓN. Los comprobantes son reales.")
	}

	srv := &http.Server{
		Addr: fmt.Sprintf(":%d", cfg.Puerto),
		Handler: servidor.Nuevo(servidor.Opciones{
			Arca:        servidor.ClientesPerezosos(cfg),
			Entorno:     cfg.Entorno,
			OrigenesWeb: cfg.OrigenesWeb,
			Log:         log,
		}),
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
