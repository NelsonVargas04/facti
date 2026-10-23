# Decisiones técnicas

## 001 — TypeScript en todo el proyecto
Backend, web y móvil comparten tipos y validaciones. Monorepo con pnpm workspaces.

## 002 — Conexión directa con ARCA, sin SDK de terceros
Se implementan WSAA y los web services con SOAP a mano (hoy en Go, ver 008).
Evita depender de servicios externos pagos y nos da control sobre errores y reintentos.

## 003 — Delegación en lugar de certificados por usuario
Cada usuario delega los servicios de facturación al CUIT de Facti desde el Administrador de Relaciones.
Facti usa un único certificado propio. Nunca se maneja la clave fiscal del usuario.

## 004 — Tickets de acceso persistidos
El WSAA no entrega un ticket nuevo si hay uno vigente, por eso se guardan en disco (luego, en Redis o la base de datos).

## 005 — Emisión serializada e idempotente
La numeración es correlativa por punto de venta y tipo. Se emite de a una y, ante un corte de red,
se consulta con FECompConsultar si el número quedó autorizado antes de reintentar.

## 006 — Parámetros normativos con vigencia
Montos (consumidor final, FCE), plazos y escalas de monotributo cambian seguido.
Se guardan con fecha de vigencia y fuente legal.

## 007 — Gestor de paquetes: pnpm
Monorepo con pnpm workspaces (`pnpm-workspace.yaml`). Más rápido y con `node_modules`
enlazado desde un store único. Los workspaces se referencian con `workspace:*`.

## 008 — API en Go (reemplaza a Fastify)
El backend (`apps/api`) está en Go, con `net/http` de la biblioteca estándar.
La conexión con ARCA se portó de `packages/arca` a `apps/api/internal/arca`
(WSAA con firma CMS vía `smallstep/pkcs7`, WSFEv1, padrón A5, QR). Se eligió Go por
el manejo de concurrencia para la cola de emisión, un binario único para desplegar y bajo consumo.
- Los clientes de ARCA se construyen de forma perezosa (en el primer request), así el server
  levanta aunque todavía no haya certificado ni `.env`.
- El `.env` se lee desde la raíz del repo y las rutas relativas se resuelven contra ella.
- Los tickets de acceso se guardan con el mismo formato y nombre de archivo que la versión TS,
  así no se pierde un ticket vigente al cambiar de una a otra.
- `apps/api/package.json` solo existe para que `pnpm dev` levante la API junto con la web.
- La decisión 001 queda acotada a web y móvil: los tipos de la API se mantienen a mano en
  `apps/web/src/lib/api.ts` (más adelante, generarlos desde un OpenAPI).

## 009 — Web con Next.js (App Router)
El frontend (`apps/web`) usa Next.js con App Router y las tipografías Quicksand/Nunito
vía `next/font`. Estilo soft UI con tokens CSS (sin framework de CSS por ahora).
La web corre en el puerto 3000 y la API en el 4000; la API habilita CORS para la web.
El navegador habla con la API por HTTP (`NEXT_PUBLIC_API_URL`).

## 010 — Base de datos: Postgres en Supabase
Los datos van a Postgres (Supabase en producción, plan gratis para empezar), con `pgx` desde la API.
- Todo vive en el esquema `facti`, no en `public`: Supabase expone `public` por su Data API y no
  queremos que las tablas sean accesibles con la clave anónima. La web nunca habla con Supabase directo.
- Migraciones SQL embebidas en el binario; se aplican al conectarse, con un lock para que no corran dos a la vez.
- Si la URL usa el pooler en modo transacción (puerto 6543), se usa el protocolo simple (sin sentencias preparadas).
- Antes de pedir el CAE se verifica que haya base y cupo en el plan. Si ARCA autoriza y después falla
  el guardado, la API responde `no_guardado` con el CAE (para no reemitir) y deja todo en el log.
- Se guarda la respuesta original de ARCA de cada comprobante (10 años) y una copia del receptor tal como
  quedó en la factura; los clientes se crean o actualizan solos al facturar.
- Sin login por ahora: una sola cuenta, la del `ARCA_CUIT_EMISOR`. Las tablas ya tienen `cuenta_id`
  para sumar usuarios (posiblemente con Supabase Auth) sin migrar datos.

## Pendientes a validar en homologación
- Que el padrón A5 devuelva la categoría de monotributo como esperamos.
- Códigos de condición frente al IVA del receptor con FEParamGetCondicionIvaReceptor.
- Dominios vigentes de los endpoints (afip.gov.ar / arca.gob.ar).
