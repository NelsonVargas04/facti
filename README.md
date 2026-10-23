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
- Go 1.24 o superior (`winget install GoLang.Go` en Windows, o desde https://go.dev/dl)
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

| Ruta | Qué hace |
| --- | --- |
| `GET /salud` | Confirma que el server está vivo y en qué entorno |
| `GET /arca/estado` | Estado de los servidores de ARCA (FEDummy) |
| `GET /arca/puntos-venta` | Puntos de venta Web Services del emisor |
| `GET /arca/condiciones-iva?clase=C` | Condiciones frente al IVA del receptor (RG 5616) |
| `GET /arca/padron/{cuit}` | Datos y condición fiscal de un CUIT del padrón |
| `POST /facturas` | Emite una Factura C y devuelve CAE, vencimiento y QR |

Errores: `400` datos inválidos · `422` ARCA rechazó el comprobante · `502` error de ARCA ·
`503` falta configuración · `504` ARCA no respondió.

## Reglas del proyecto

- Nunca pedir ni guardar la clave fiscal del usuario: se usa la delegación del web service al CUIT de Facti.
- Certificados y claves privadas fuera del repo; en producción, en un gestor de secretos.
- Una emisión a la vez por punto de venta y tipo. Si ARCA no responde, consultar antes de reintentar.
- Montos, plazos y escalas que fija la normativa van en `packages/shared/src/parametros.ts` con su fuente y vigencia, nunca fijos en el código.
- Guardar CAE, PDF y la respuesta de ARCA de cada comprobante durante 10 años.
