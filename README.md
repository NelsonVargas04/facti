# Facti

Herramienta complementaria y de ayuda para facturar en ARCA: facturas A, B, C, M y E, panel de monotributo y cobros, desde un solo lugar.

> Facti no es ARCA ni un organismo oficial. Los comprobantes los autoriza siempre ARCA.

## Estado

La API en Go (`apps/api`) se conecta con los web services oficiales; la web (`apps/web`) tiene las pantallas del MVP.

| Servicio de ARCA | Estado |
| --- | --- |
| WSAA (autenticación con certificado) | Listo para probar |
| WSFEv1 (facturas A, B, C, M y notas) | Listo para probar |
| Padrón A5 (constancia de inscripción) | Listo para probar |
| QR del comprobante | Listo |
| WSFEX (Factura E) | Próximo paso |

## Estructura

```
apps/
  api/      Backend en Go — puerto 4000
    cmd/api/            el servidor HTTP
    cmd/arca/           pruebas manuales contra homologación (pnpm arca:*)
    internal/arca/      conexión con ARCA: WSAA, WSFEv1, padrón, QR y tablas de códigos
    internal/servidor/  rutas, CORS y manejo de errores
    internal/cuit/      validación de CUIT
    internal/config/    lectura del .env
    internal/datos/     base de datos: Postgres (Supabase) y una versión en memoria para tests
  web/      Frontend (Next.js) con el diseño de Facti — puerto 3000
packages/
  shared/   Validación de CUIT y parámetros normativos con fecha de vigencia (TS, para la web)
  arca/     Versión anterior en TypeScript de la conexión con ARCA (referencia; la usa scripts/)
docs/       Decisiones técnicas
certs/      Certificados locales (ignorados por git)
```

Próxima carpeta: `apps/mobile` (Expo).

## Requisitos

- Node.js 20.6 o superior
- pnpm 9 o superior (`npm i -g pnpm` o `corepack enable`)
- Go 1.25 o superior (`winget install GoLang.Go` en Windows, o desde https://go.dev/dl)
- CUIT con clave fiscal nivel 3 (para el certificado de homologación)

## Primeros pasos

```bash
pnpm install
pnpm test          # tests de TypeScript (vitest) y de la API (go test)
cp .env.example .env
```

### 1. Certificado de homologación

Generá la clave privada y el pedido de certificado (reemplazá el CUIT y los nombres):

```bash
openssl genrsa -out certs/homologacion.key 2048
openssl req -new -key certs/homologacion.key \
  -subj "/C=AR/O=Facti/CN=facti-homologacion/serialNumber=CUIT 20111111112" \
  -out certs/homologacion.csr
```

Después, en ARCA con tu clave fiscal:

1. Adherí el servicio **"WSASS - Autogestión Certificados Homologación"**.
2. En WSASS, creá un certificado pegando el contenido de `homologacion.csr` y guardá el resultado como `certs/homologacion.crt`.
3. Autorizá ese certificado para los servicios **wsfe** y **ws_sr_constancia_inscripcion**.

### 2. Punto de venta

En homologación se puede usar un punto de venta de prueba. En producción, el usuario crea uno de tipo Web Services desde "Administración de puntos de venta y domicilios".

### 3. Probar

```bash
pnpm arca:probar              # estado de ARCA, puntos de venta y último número
pnpm arca:padron 20123456786  # datos de un CUIT del padrón
pnpm arca:factura-c           # emite una Factura C de prueba y muestra CAE y QR
```

## Levantar la app

Un solo comando prende la web y la API juntas:

```bash
pnpm dev
#   web  -> http://localhost:3000   (lo que abrís en el navegador, con recarga en caliente)
#   api  -> http://localhost:4000   (backend JSON en Go; reiniciala después de cambiar código Go)
```

O por separado: `pnpm dev:web` / `pnpm dev:api`. La API también se puede correr directo con
`go run ./cmd/api` desde `apps/api`.

### Web (`apps/web`, Next.js)

El frontend con el diseño de Facti. Abrí `http://localhost:3000`:

- `/` — landing con la mascota y las features.
- `/estado` — chequeo en vivo de la API y de los servidores de ARCA.

### API (`apps/api`, Go)

El backend arranca aunque todavía no haya `.env` ni certificado: las rutas de
salud funcionan siempre, y las de ARCA responden `503` con un mensaje claro
hasta que completes la configuración. Lee el `.env` de la raíz del repo.
Todas las rutas, salvo `/salud` y `/arca/estado`, piden la sesión de Supabase
(`Authorization: Bearer <token>`) y responden `401` sin ella.

| Ruta | Qué hace |
| --- | --- |
| `GET /salud` | Confirma que el server está vivo y en qué entorno |
| `GET /arca/estado` | Estado de los servidores de ARCA (FEDummy) |
| `GET /arca/puntos-venta` | Puntos de venta Web Services del emisor |
| `GET /arca/condiciones-iva?clase=C` | Condiciones frente al IVA del receptor (RG 5616) |
| `GET /arca/padron/{cuit}` | Datos y condición fiscal de un CUIT del padrón |
| `POST /facturas` | Emite una Factura C, la guarda y devuelve id, CAE, vencimiento y QR |
| `GET /cuenta` | Cuenta del usuario (se crea al primer ingreso), perfil del padrón y uso del plan |
| `PUT /cuenta/cuit` | Guarda el CUIT del usuario y, si ARCA está conectado, trae su perfil del padrón |
| `GET /resumen?mes=AAAA-MM` | Facturado, por cobrar y cobrado del mes, últimos 12 meses y últimas facturas |
| `GET /comprobantes` | Listado con filtros `desde`, `hasta`, `q`, `cobro`, `orden`, `limite`, `saltar` |
| `GET /comprobantes/{id}` | Comprobante con ítems y datos del emisor (para el PDF) |
| `PATCH /comprobantes/{id}/cobro` | Marca la factura como `cobrada` o `pendiente` |
| `GET /clientes?q=` | Clientes (se guardan solos al facturar) con lo facturado y lo pendiente |

Errores: `400` datos inválidos · `403` se terminó el cupo del plan · `404` no existe ·
`422` ARCA rechazó el comprobante · `500 no_guardado` ARCA autorizó pero no se pudo guardar (no reintentar) ·
`502` error de ARCA · `503` falta configuración o base de datos · `504` ARCA no respondió.

### Base de datos (Supabase)

La API guarda cuentas, clientes y comprobantes en Postgres. En producción se usa Supabase:

1. Creá un proyecto en [supabase.com](https://supabase.com) (el plan gratis alcanza para empezar).
2. En **Project Settings → Database → Connection string → URI**, copiá la URL (Session pooler) y
   reemplazá `[YOUR-PASSWORD]` por la contraseña de la base.
3. Pegala en `DATABASE_URL` del `.env` de la raíz y reiniciá la API.

Las tablas se crean solas la primera vez, en el esquema `facti` (no en `public`, así no quedan
expuestas por la API pública de Supabase). Las migraciones están en `apps/api/internal/datos/migraciones/`.

### Inicio de sesión con Google (Supabase Auth)

La web inicia sesión con Supabase (Google o email y contraseña) y manda el token a la API, que lo
valida con las claves públicas del proyecto. Cada usuario tiene su cuenta y carga su CUIT en el
primer paso del onboarding.

1. **Claves en el `.env`**: en Supabase, *Project Settings → API Keys*, copiá la URL del proyecto y la
   *publishable key* en `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **URLs permitidas**: en *Authentication → URL Configuration*, poné `http://localhost:3000` como
   *Site URL* y agregá `http://localhost:3000/auth/callback` y `http://localhost:3000/auth/nueva-clave`
   en *Redirect URLs* (y las de producción cuando las tengas).
3. **Google**: en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) creá un
   *ID de cliente de OAuth* de tipo *Aplicación web*, con este URI de redireccionamiento autorizado:
   `https://<tu-proyecto>.supabase.co/auth/v1/callback`. Después, en Supabase, *Authentication →
   Sign In / Providers → Google*, activalo y pegá el *Client ID* y el *Client Secret*.
4. Reiniciá la web y la API (`pnpm dev`).

Para correr los tests de la base contra Postgres (si no, usan una base en memoria):

```bash
TEST_DATABASE_URL="postgresql://..." go test ./internal/datos/
```

## Reglas del proyecto

- Nunca pedir ni guardar la clave fiscal del usuario: se usa la delegación del web service al CUIT de Facti.
- Certificados y claves privadas fuera del repo; en producción, en un gestor de secretos.
- Una emisión a la vez por punto de venta y tipo. Si ARCA no responde, consultar antes de reintentar.
- Montos, plazos y escalas que fija la normativa van en `packages/shared/src/parametros.ts` con su fuente y vigencia, nunca fijos en el código.
- Guardar CAE, PDF y la respuesta de ARCA de cada comprobante durante 10 años.
