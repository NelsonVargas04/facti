# Facti — contexto para Claude Code

Facti es una app web (después móvil) de facturación electrónica para Argentina, conectada con ARCA.
Es una herramienta **complementaria y de ayuda**: hace lo de ARCA más simple y amigable, todo desde un solo lugar.
No es ARCA ni un organismo oficial, y no reemplaza a un contador.

## Producto (MVP)
- Usuarios: monotributo, monotributo social, responsable inscripto, exento, no alcanzado y personas jurídicas (SAS, SRL, SA).
- Comprobantes: A, B, C y M (WSFEv1) con notas de crédito y débito, y E de exportación (WSFEX).
- Elegir el tipo de factura solo, según el padrón de ARCA del emisor y del receptor:
  - Monotributista o exento → siempre C.
  - Responsable inscripto → A a otro inscripto; A con leyenda Ley 27.618 a monotributista; B a consumidor final o exento.
- **El formulario de emisión se configura por tipo** (cada comprobante pide solo lo que corresponde, tal cual ARCA):
  - **C**: no discrimina IVA; concepto productos/servicios; período desde/hasta solo si es servicio; pesos.
  - **E** (WSFEX): solo servicios; sin período desde/hasta (el mes va en la descripción del ítem); país destino, ID impositivo del exterior, moneda + cotización, forma de pago, incoterms; IVA exento.
  - **A/M**: discriminan IVA por alícuota (neto + IVA + total); A lleva leyenda Ley 27.618 si el receptor es monotributista. **B**: IVA incluido en el precio. (Se habilitan en la fase de responsable inscripto.)
- PDF en el **formato oficial de ARCA** (mismo orden y datos que el comprobante de ARCA, con QR, CAE y vencimiento), pero más prolijo.
- Panel de monotributo: facturación de 12 meses, tope de categoría, aviso de recategorización.
- Pagos de monotributo: ARCA no tiene web service para generar VEP ni consultar pagos. Facti guía al usuario a generar el VEP en ARCA y **lee el PDF del comprobante de pago** que sube.
- Cobros: marcar facturas como cobradas o pendientes (dentro de Facti).
- **Fase 1 (en curso): solo persona humana (física)** — monotributo, responsable inscripto, exento. Sociedades y asociaciones quedan para fases siguientes.
- Planes:
  - **Gratis**: 10 facturas A/B/C por mes + 1 Factura E por mes, PDF y panel de monotributo. Sin recordatorios.
  - **Pro (pago)**: A/B/C y Factura E ilimitadas, recordatorios de cobro y registro de cobros. (FCE MiPyME y multi-CUIT, más adelante.)
  - Los recordatorios de cobro son exclusivos del plan pago.

## Servicios de ARCA del MVP
- WSAA (autenticación con certificado, firma CMS del TRA).
- WSFEv1 (facturas A, B, C, M y notas).
- WSFEX (Factura E).
- Padrón A5, servicio ws_sr_constancia_inscripcion (datos y condición fiscal de un CUIT).

## Fuera del MVP (fases siguientes)
CAEA de contingencia, FCE MiPyME (WSFECred), constatación de comprobantes (WSCDC), Ventanilla Electrónica, importar "Mis Comprobantes" (CSV).

## Reglas que no se rompen
- **Nunca** pedir ni guardar la clave fiscal del usuario. Se usa la delegación del web service al CUIT de Facti (Administrador de Relaciones de Clave Fiscal).
- Certificados y claves privadas fuera del repo (en producción, en un gestor de secretos).
- El WSAA no entrega un ticket nuevo si hay uno vigente: persistir los tickets de acceso.
- Emitir de a uno por punto de venta y tipo; ante un corte de red, consultar con FECompConsultar antes de reintentar.
- Montos, plazos y escalas legales van en `packages/shared/src/parametros.ts` con fuente y vigencia, nunca fijos en el código.
- Guardar CAE, PDF y respuesta de ARCA durante 10 años.
- Textos de la app en español rioplatense (voseo), tono amigable.

## Normativa a tener en cuenta (al 14/10/2026)
- RG 1415 (tipos de comprobante y datos obligatorios), RG 4291 (factura electrónica).
- RG 5616: condición frente al IVA del receptor obligatoria en cada pedido (CondicionIVAReceptorId).
- RG 5782/5785: CAE como regla desde 01/08/2026; CAEA solo contingencia.
- RG 5866/2026: vigente desde 01/07/2026 (Liquidación Electrónica Mensual, puntos de venta).
- RG 5893/2026: monotributo social factura electrónica desde 01/11/2026; no alcanzados desde 01/03/2027.
- RG 5700/2025: identificar al consumidor final desde $10.000.000.
- Ley 27.618: leyenda obligatoria en Factura A a monotributistas; pago a la CBU del emisor.
- FCE MiPyME (Ley 27.440): monto mínimo $5.549.862 desde 14/04/2026; plazo de 21 días hasta 31/10/2026 (después 15 días si no hay prórroga).
- Monotributo: categorías A a K, escalas semestrales (feb/ago). Tope A $12.009.410,45 y K $126.610.838,75 desde 01/08/2026.
- QR: JSON en Base64 en https://www.arca.gob.ar/fe/qr/?p=... con ver, fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, moneda, ctz, tipoDocRec, nroDocRec, tipoCodAut ("E" CAE, "A" CAEA), codAut.
- Ley 25.326 (datos personales) y Ley 24.240 (botón de arrepentimiento y de baja, Disp. 954/2025).

## Diseño
- **Sistema de diseño completo en [`docs/diseno/DISENO.md`](docs/diseno/DISENO.md)**: tokens (colores, tipografías, radios, sombras), componentes, mascota y rutas. Los mockups HTML están en `docs/diseno/pantallas/` y los SVG de la mascota en `docs/diseno/facti/`. Es la referencia para `apps/web`.
- Estilo "playful / soft UI": fondo #F2F5F9, índigo #3B3FD8, amarillo #FFD25E, verde menta #D7F5E6, texto #15193A.
- Tipografías: Quicksand (títulos) y Nunito (texto). Botones redondeados tipo píldora, tarjetas blancas con sombra suave.
- Mascota **Facti**: ticket de factura lila (#7B7FF2) con borde en zigzag, manos amarillas, cachetes rosados.
  Poses: saludo, ok, festejo, factura, pensando, señalando, buscando, alerta, durmiendo. Una sola pose animada por pantalla; respetar prefers-reduced-motion.
- Pantallas diseñadas: landing, crear cuenta, perfil fiscal, autorizar en ARCA, inicio, emitir factura, factura emitida, pagos de monotributo, y PDFs de Factura A, C y E.

## Estructura del repo
- Monorepo con pnpm workspaces, Node >= 20.6 y Go >= 1.25.
- `apps/api`: **backend en Go** (`net/http`, módulo `facti/api`). `internal/arca` (WSAA, WSFEv1, padrón A5, QR, códigos), `internal/servidor` (rutas, CORS, errores), `internal/cuit`, `internal/config` (lee el `.env` de la raíz), `internal/datos` (Postgres/Supabase con pgx en el esquema `facti`, migraciones embebidas en `migraciones/`; `Memoria` implementa la misma interfaz para tests y `TestContrato` prueba las dos). Por ahora hay una sola cuenta (la de `ARCA_CUIT_EMISOR`); el login queda para después. `cmd/api` es el server y `cmd/arca` las pruebas manuales (`pnpm arca:probar|padron|factura-c`). Tests con `go test ./...`.
- `apps/web`: Next.js (App Router), puerto 3000. Habla con la API por `NEXT_PUBLIC_API_URL` (por defecto http://localhost:4000) con `lib/api.ts` y el hook `lib/useApi.ts`; los errores se muestran con `components/AvisoApi`. Solo los pagos de monotributo siguen con datos de ejemplo.
- `packages/shared`: validación de CUIT y parámetros normativos con vigencia (TS, para la web).
- `packages/arca` y `scripts`: versión anterior en TypeScript, queda como referencia. Los cambios nuevos de ARCA van en Go.
- `pnpm dev` levanta web y API juntas; `pnpm test` corre vitest y go test.
- Próximo: cola de emisión y PDF en la API, luego `apps/mobile` (Expo).

## Endpoints (verificar contra los manuales vigentes)
- Homologación: WSAA https://wsaahomo.afip.gov.ar/ws/services/LoginCms · WSFEv1 https://wswhomo.afip.gov.ar/wsfev1/service.asmx · Padrón https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5
- Producción: WSAA https://wsaa.afip.gov.ar/ws/services/LoginCms · WSFEv1 https://servicios1.afip.gov.ar/wsfev1/service.asmx · Padrón https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5

## Pendientes a validar en homologación
- Formato de respuesta del padrón A5 (categoría de monotributo; impuesto 30 = IVA, 32 = IVA exento).
- Códigos de condición IVA del receptor (FEParamGetCondicionIvaReceptor).
- Dominios vigentes de los endpoints (afip.gov.ar / arca.gob.ar).

---

## Primera tarea

1. Inicializá el monorepo con npm workspaces, TypeScript estricto, vitest y tsx. Agregá .gitignore (node_modules, .env, .cache, certs/*) y un .env.example con: ARCA_ENTORNO, ARCA_CUIT_CERTIFICADO, ARCA_CUIT_EMISOR, ARCA_PUNTO_VENTA, ARCA_CERT_PATH, ARCA_KEY_PATH, ARCA_CACHE_DIR.
2. Creá `packages/arca` usando SOAP sobre fetch, fast-xml-parser y node-forge (sin SDKs de terceros pagos):
   - config.ts (endpoints por entorno), errores.ts (ArcaError y ArcaSinRespuestaError), soap.ts.
   - wsaa.ts: crearTRA, firmarTRA (CMS con SHA-256), loginCms y una caché de tickets en memoria y en disco.
   - wsfe.ts: estado (FEDummy), ultimoAutorizado, puntosDeVenta, condicionesIvaReceptor, consultar, y emitir con bloqueo por punto de venta y tipo, validación de importes y consulta previa a reintentar.
   - padron.ts: getPersona_v2 e interpretación de la condición fiscal.
   - codigos.ts (tipos de comprobante, conceptos, documentos, condición IVA, alícuotas, facturaSugerida, leyenda Ley 27.618), fechas.ts (AAAAMMDD en hora argentina), qr.ts (urlQR y leerUrlQR).
3. Creá `packages/shared` con validarCuit, formatearCuit y parametros.ts (con obtenerParametro por fecha).
4. Creá los scripts `probar-conexion.ts`, `consultar-padron.ts` y `emitir-factura-c.ts` (este último solo en homologación) y sus comandos npm.
5. Escribí tests para todo lo que no necesita red, y corré typecheck y tests hasta que pasen.
6. Escribí un README en español con el paso a paso para generar el certificado de homologación (openssl + WSASS) y autorizar wsfe y ws_sr_constancia_inscripcion.
7. Hacé el primer commit.

Cuando termines, mostrame un resumen y decime qué necesitás de mí para probar la conexión real con ARCA.
