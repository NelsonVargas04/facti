package servidor

import (
	"crypto/subtle"
	"net/http"
	"strings"
	"time"

	"facti/api/internal/arca"
)

// GET /api/admin/report: métricas globales para el portal de administración (admin-portal).
// Sin sesión de usuario: se protege con "Authorization: Bearer <ADMIN_REPORT_TOKEN>".
// Solo devuelve conteos e importes agregados, nunca datos de las cuentas.
func (s *Servidor) reporteAdmin(w http.ResponseWriter, r *http.Request) error {
	if s.adminToken == "" {
		return &ConfiguracionError{Mensaje: "Falta ADMIN_REPORT_TOKEN para el reporte de administración."}
	}
	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.adminToken)) != 1 {
		return errSinSesion
	}
	d, err := s.datos(r.Context())
	if err != nil {
		return err
	}
	m, err := d.MetricasAdmin(r.Context(), s.hoyAR().Format("2006-01-02"))
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}

	// Homologación de ARCA = staging; producción = production.
	entorno := "staging"
	if s.entorno == arca.Produccion {
		entorno = "production"
	}
	uso := map[string]any{"activeUsers": m.CuentasActivas}
	if m.BytesBase > 0 {
		uso["storageMb"] = m.BytesBase / (1 << 20)
	}
	w.Header().Set("Cache-Control", "no-store")
	responderJSON(w, http.StatusOK, map[string]any{
		"environments": map[string]any{
			entorno: map[string]any{"version": s.version, "lastDeployAt": s.inicio.UTC().Format(time.RFC3339)},
		},
		"usage": uso,
		"billing": map[string]any{
			"currency":        "ARS",
			"revenueMonth":    m.CobradoMes,
			"mrr":             m.MRR,
			"openInvoices":    m.PagosPendientes,
			"overdueInvoices": m.PagosRechazados,
		},
		"costs": []any{},
		"metrics": []map[string]any{
			{"label": "Cuentas", "value": m.Cuentas},
			{"label": "Con CUIT cargado", "value": m.CuentasConCuit},
			{"label": "Pro", "value": m.CuentasPro},
			{"label": "Comprobantes del mes", "value": m.ComprobantesMes},
			{"label": "Comprobantes (30 días)", "value": m.Comprobantes30d},
		},
	})
	return nil
}
