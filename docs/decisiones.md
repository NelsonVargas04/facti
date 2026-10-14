# Decisiones técnicas

## 001 — TypeScript en todo el proyecto
Backend, web y móvil comparten tipos y validaciones. Monorepo con npm workspaces.

## 002 — Conexión directa con ARCA, sin SDK de terceros
Se implementan WSAA y los web services con SOAP sobre `fetch` y `node-forge` para la firma CMS.
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

## Pendientes a validar en homologación
- Que el padrón A5 devuelva la categoría de monotributo como esperamos.
- Códigos de condición frente al IVA del receptor con FEParamGetCondicionIvaReceptor.
- Dominios vigentes de los endpoints (afip.gov.ar / arca.gob.ar).
