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

	"facti/api/internal/auth"
	"facti/api/internal/config"
	"facti/api/internal/demo"
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
	if cfg.DatabaseURL == "" {
		log.Warn("falta DATABASE_URL: las facturas, clientes y cobros no se pueden guardar ni leer")
	}
	if cfg.Entorno == "produccion" {
		log.Warn("ATENCIÓN: ARCA en PRODUCCIÓN. Los comprobantes son reales.")
	}
	// Sin Supabase no hay sesiones: las rutas con datos responden 503 hasta configurarlo.
	var autenticador servidor.Autenticador
	if cfg.SupabaseURL != "" {
		autenticador = auth.NuevoSupabase(cfg.SupabaseURL, cfg.SupabaseJWTSecret)
	} else {
		log.Warn("falta SUPABASE_URL: nadie puede iniciar sesión")
	}

	datosApp := servidor.DatosPerezosos(cfg.DatabaseURL)
	// Modo demo (solo en la compu): cuenta de prueba en memoria, sin Supabase ni Postgres.
	if os.Getenv("FACTI_DEMO") == "1" {
		if cfg.Entorno == "produccion" {
			log.Error("FACTI_DEMO no se puede usar con ARCA_ENTORNO=produccion")
			os.Exit(1)
		}
		m, err := demo.Datos(cfg.PuntoVenta)
		if err != nil {
			log.Error("no se pudo armar la cuenta de prueba", "error", err)
			os.Exit(1)
		}
		datosApp = servidor.FijarDatos(m)
		autenticador = demo.Autenticador{}
		log.Warn("MODO DEMO: cuenta de prueba en memoria (se borra al reiniciar), sin Supabase ni base de datos")
	}

	srv := &http.Server{
		Addr: fmt.Sprintf(":%d", cfg.Puerto),
		Handler: servidor.Nuevo(servidor.Opciones{
			Arca:        servidor.ClientesPerezosos(cfg),
			Datos:       datosApp,
			Auth:        autenticador,
			PuntoVenta:  cfg.PuntoVenta,
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
