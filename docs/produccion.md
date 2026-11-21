# Pasar Facti a producción

> Paso a paso para que Facti emita facturas reales. Escrito el 21/11/2026 a partir del código actual.
> Lo que se hace en ARCA lo tenés que hacer vos con tu clave fiscal: nadie más puede (ni debe) tenerla.
> Al final hay una lista para tildar.

## Antes de empezar

- **Qué se lanza:** monotributistas que emiten Factura C y notas de crédito C, con el panel de monotributo, cobros, clientes, calendario y Mis Comprobantes.
- **Qué no se lanza todavía:** Factura E (WSFEX no está integrado), responsable inscripto (A, B, M) y la app móvil.
- **Plan Pro:** el cobro con Mercado Pago tiene que andar al lanzar (sección 6). Mientras `MP_ACCESS_TOKEN` esté vacío, "Plan y pagos" queda en vista previa y no se cobra nada.
- **Login:** "Iniciar sesión con Google" tiene que andar al lanzar (sección 5).
- **Entornos separados:** producción usa **otro certificado y otro proyecto de Supabase**, distintos de los de pruebas, para que nada de homologación se mezcle con facturas reales.

---

## 1. Certificado de producción (en ARCA, con tu clave fiscal)

Es el certificado de Facti: el del CUIT al que los usuarios le delegan la facturación (`NEXT_PUBLIC_CUIT_FACTI`).

1. Generá la clave privada y el pedido de certificado (reemplazá `20XXXXXXXXX` por el CUIT de Facti). Los archivos quedan en `certs/`, que no se sube al repo:

   ```bash
   openssl genrsa -out certs/produccion.key 2048
   ```

   ```bash
   openssl req -new -key certs/produccion.key -subj "/C=AR/O=Facti/CN=facti/serialNumber=CUIT 20XXXXXXXXX" -out certs/produccion.csr
   ```

2. En ARCA, adherí el servicio **"Administración de Certificados Digitales"** (si no lo tenés) y entrá.
3. Agregá un alias (por ejemplo `facti`), subí `produccion.csr` y descargá el certificado. Guardalo como `certs/produccion.crt`.
4. En el **Administrador de Relaciones de Clave Fiscal**, tocá "Nueva relación" y asociá ese certificado (el "computador fiscal" con el alias `facti`) a estos dos servicios:
   - **Facturación electrónica** (`wsfe`)
   - **Consulta de constancia de inscripción** (`ws_sr_constancia_inscripcion`)
5. **Guardá una copia de `produccion.key` en un lugar seguro**, fuera de la compu: un gestor de contraseñas o un pendrive guardado. Si se pierde, hay que generar otro certificado; si alguien la roba, puede facturar en nombre de Facti.

> **A verificar en la primera prueba (paso 6):** la guía de la app le pide a cada usuario que delegue "Facturación electrónica" al **CUIT** de Facti. En homologación probamos siempre con el mismo CUIT del certificado. Hay que confirmar con un segundo CUIT real que ARCA acepta emitir con esa delegación. Si no la acepta, es probable que haya que delegar al computador fiscal (alias) de Facti, y habría que ajustar la guía y el video.

## 2. Punto de venta (en ARCA, para cada usuario, vos incluido)

Cada usuario necesita un punto de venta de tipo **Web Services**:
ARCA → "Administración de puntos de venta y domicilios" → Agregar → sistema **"Factura Electrónica – Monotributo – Web Services"**.
El número que elija lo carga en Facti, en Configuración. Si todavía no está, sumarlo a la guía "Conectar con ARCA".

## 3. Supabase de producción

1. Creá un proyecto nuevo en Supabase (por ejemplo `facti-produccion`).
2. **Base:** no hace falta crear tablas, porque la API las crea solas en el esquema `facti` la primera vez que se conecta. Usá la cadena del "Session pooler" (puerto 5432) para `DATABASE_URL`.
3. **Inicio de sesión:** habilitá Google y email (igual que en pruebas). En Authentication → URL Configuration, poné como "Site URL" la dirección real de la web y agregá `https://<tu-web>/auth/callback` en "Redirect URLs". En Google Cloud, sumá la URL de callback de Supabase del proyecto nuevo.
4. **Copias de seguridad:** hay que guardar CAE, PDF y respuesta de ARCA durante 10 años. El plan gratis de Supabase no tiene copias diarias ni recuperación a un momento dado. Antes de tener usuarios reales, pasá al plan pago o programá un respaldo propio (por ejemplo, un `pg_dump` semanal guardado aparte).

## 4. Vercel (web y API)

Ya están armados los dos proyectos: la web en Next.js y la API en Go, como servidor que escucha en `PORT`. Para producción, cargá estas variables en el entorno **Production** de cada uno.

**API (`apps/api`)**

| Variable | Valor |
|---|---|
| `ARCA_ENTORNO` | `produccion` |
| `ARCA_CUIT_CERTIFICADO` | CUIT de Facti |
| `ARCA_CERT_PEM` / `ARCA_KEY_PEM` | contenido de `produccion.crt` y `produccion.key` (el PEM tal cual o en base64) |
| `ARCA_PUNTO_VENTA` | punto de venta con el que arrancan las cuentas nuevas (cada uno lo cambia después) |
| `DATABASE_URL` | la de Supabase de producción |
| `NEXT_PUBLIC_SUPABASE_URL` | la de Supabase de producción |
| `SUPABASE_JWT_SECRET` | solo si el proyecto usa el secreto legado (HS256) |
| `WEB_ORIGIN` | la URL de la web (por ejemplo `https://facti.com.ar`), **nunca vacía en producción** |
| `WEB_URL` | la misma URL de la web |
| `CRON_SECRET` | una clave larga al azar (para las facturas recurrentes automáticas) |
| `FACTI_DEMO` | **vacía** (la API se niega a arrancar en producción con el modo demo) |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | vacías para lanzar sin cobrar; las de producción cuando actives Pro |

**Web (`apps/web`)**

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | la URL de la API en Vercel |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | las de Supabase de producción |
| `NEXT_PUBLIC_CUIT_FACTI` | CUIT de Facti (se muestra en la guía de conexión) |
| `NEXT_PUBLIC_DEMO` | **vacía** (si no, aparece "Entrar con la cuenta de prueba") |

**Falta en el código:** no hay `vercel.json` con el cron diario que llama a `GET /recurrentes/procesar`. Sin eso, las facturas recurrentes **automáticas** no se emiten solas (las manuales andan igual). Es un archivo de pocas líneas; se puede sumar antes de lanzar o dejar las recurrentes en modo manual.

**Dominio (opcional):** comprá el dominio (por ejemplo en NIC Argentina para `.com.ar`), apuntalo a Vercel y actualizá `WEB_ORIGIN`, `WEB_URL` y las URLs de Supabase.

## 5. Iniciar sesión con Google

**Estado del código: completo.** La web usa Supabase Auth con PKCE: el botón de Google en `/ingresar` y `/registro` vuelve a `/auth/callback`, que manda al onboarding si todavía no hay CUIT. La API valida cada sesión con las claves públicas del proyecto (JWKS).

**Problema encontrado (21/11/2026):** la URL de Supabase de tu `.env` local (`NEXT_PUBLIC_SUPABASE_URL`) apunta a un proyecto que **ya no existe**: el dominio no resuelve. Hoy, en la compu, no se puede iniciar sesión ni con Google ni con email, solo con la cuenta de prueba. Fijate en Supabase cuál es el proyecto vigente (puede ser el que creó la integración con Vercel) y corregí la URL y la clave en el `.env` y en Vercel.

**Configuración (una vez por proyecto de Supabase):**
1. **Google Cloud Console** → APIs y servicios → Credenciales → "ID de cliente de OAuth" de tipo **Aplicación web**:
   - Orígenes de JavaScript autorizados: la URL de la web (por ejemplo `https://facti.com.ar`).
   - URI de redireccionamiento autorizados: `https://<ref-del-proyecto>.supabase.co/auth/v1/callback`.
2. **Pantalla de consentimiento de OAuth**: nombre "Facti", email de soporte, logo, links a términos y privacidad. **Publicala ("En producción")**. Si queda en "Prueba", solo pueden entrar las cuentas que agregues a mano: es la causa más común de que Google "ande para vos y para nadie más".
3. **Supabase** → Authentication → Sign In / Providers → Google: activalo y pegá el Client ID y el Client Secret.
4. **Supabase** → Authentication → URL Configuration:
   - Site URL: la URL de la web.
   - Redirect URLs: `https://<tu-web>/auth/callback` y `https://<tu-web>/auth/nueva-clave` (para recuperar la contraseña por email).

**Cómo probarlo:**
- [ ] Entrar con Google con **tu** cuenta: llega al onboarding y, después de cargar el CUIT, al inicio.
- [ ] Entrar con Google con **otra** cuenta, de alguien que nunca usó Facti (confirma que la pantalla de consentimiento está publicada).
- [ ] Cerrar sesión y volver a entrar: sigue siendo la misma cuenta, con sus facturas.
- [ ] Registro con email y contraseña: llega el mail de confirmación y el link funciona.

## 6. Cobro de Facti Pro con Mercado Pago

**Estado del código: completo, pero nunca probado contra Mercado Pago de verdad** (`MP_ACCESS_TOKEN` siempre estuvo vacío; los tests usan un Mercado Pago simulado). El flujo:
1. En "Plan y pagos", "Pasar a Pro" crea una suscripción mensual (preapproval) por el precio en dólares (`FACTI_PRECIO_PRO_USD`) pasado a pesos con el dólar del BCRA del día, y manda al usuario al checkout de Mercado Pago. Facti nunca ve la tarjeta.
2. Al volver (`/app/cuenta?mp=vuelta`), Facti le pregunta a Mercado Pago cómo quedó. Si está autorizada, la cuenta pasa a Pro.
3. Cada mes, Mercado Pago avisa por webhook (firmado con `MP_WEBHOOK_SECRET`) y Facti vuelve a consultar el estado y los cobros.
4. "Dar de baja" cancela la suscripción en Mercado Pago. La cuenta sigue en Pro hasta el final de lo que ya pagó y después vuelve sola a Gratis.

**Prueba con credenciales de prueba (antes de cobrar de verdad):**
1. Mercado Pago Developers → Tus integraciones → creá la aplicación "Facti" (producto: Suscripciones).
2. En "Cuentas de prueba" creá dos usuarios de prueba: **vendedor** y **comprador**.
3. Entrá a Developers con el usuario **vendedor** de prueba y copiá *su* access token a `MP_ACCESS_TOKEN`. En Webhooks, cargá `https://<tu-api>/webhooks/mercadopago` con los eventos de **suscripciones** (planes y suscripciones, pagos autorizados) y copiá la clave secreta a `MP_WEBHOOK_SECRET`.
4. Hacelo en un deploy de Vercel (preview), no en la compu: Mercado Pago no acepta `http://localhost` como vuelta, y el webhook necesita una URL pública. `WEB_URL` tiene que ser la URL https de la web.
5. En Facti, con una cuenta cuyo email sea **el del comprador de prueba**, tocá "Pasar a Pro", pagá con una tarjeta de prueba de Mercado Pago y revisá:
   - [ ] vuelve a Facti y dice "¡Listo! Ya tenés Facti Pro" (o se actualiza a los pocos minutos);
   - [ ] en "Plan y pagos" aparece el pago, con el medio (marca y últimos 4);
   - [ ] en los logs de la API llega el webhook sin "firma inválida";
   - [ ] "Dar de baja" la cancela, la cuenta sigue en Pro hasta el día antes del próximo cobro y "Volver a Pro" funciona;
   - [ ] con una tarjeta de prueba rechazada, la cuenta **no** pasa a Pro.
6. Si todo anda, cambiá a las credenciales de **producción** de la misma aplicación (y su clave de webhook) y repetí una vez con tu propia tarjeta.

**Riesgos y decisiones pendientes:**
- **Email del pagador:** la suscripción se crea con el email de la cuenta de Facti (`payer_email`). Mercado Pago puede rechazar el pago si el usuario entra al checkout con una cuenta de Mercado Pago de **otro** email (por ejemplo, entró a Facti con Google y paga con otra cuenta). **Verificarlo en la prueba.** Si pasa, hay que pedir "tu email de Mercado Pago" antes de mandarlo al checkout.
- **Baja (resuelto el 21/11/2026):** al dar de baja, la cuenta sigue en Pro hasta el día antes del próximo cobro (lo que ya pagó) y después pasa sola a Gratis. Si vuelve a Pro en ese tiempo, la suscripción nueva empieza a cobrar recién al terminar lo pagado. **Probarlo con Mercado Pago de prueba:** que acepte `start_date` en una suscripción nueva.
- **Precio:** el importe en pesos queda fijo el día que se suscribe; no sigue al dólar mes a mes.
- **Facturar a tus clientes:** cada cobro de Pro es una venta tuya y hay que facturarla (podés usar Facti con tu CUIT). Hoy es manual.

## 7. Antes de la primera factura real

- [ ] En la web de producción **no** aparece "Entrar con la cuenta de prueba".
- [ ] `https://<tu-api>/arca/estado` responde con los tres servidores de ARCA en "OK".
- [ ] El log de la API dice "ARCA en PRODUCCIÓN".
- [ ] Términos, privacidad, y los botones de arrepentimiento y de baja se ven en el pie.

## 8. Prueba de punta a punta (con tu CUIT)

1. Creá tu cuenta en la web de producción, cargá tu CUIT y seguí la guía "Conectar con ARCA" (delegación y punto de venta).
2. Emití una **Factura C real chica** (por ejemplo $100 a consumidor final).
3. Revisá que:
   - el PDF salga bien y con los datos completos;
   - el QR, escaneado con el celular, abra la página de ARCA y muestre la factura;
   - la factura aparezca en ARCA → "Mis Comprobantes" → Emitidos.
4. **Anulala con una nota de crédito** desde la misma factura. Así no suma a tu facturación del monotributo.
5. **Segundo CUIT:** pedile a alguien de confianza que sea monotributista que haga lo mismo con su cuenta. Es la prueba que confirma que la delegación funciona con un CUIT distinto al de Facti (ver la nota del paso 1).

## 9. Legal y datos personales

- Los textos legales ya están en la web. Revisá que el nombre y CUIT del responsable sean los reales.
- **Ley 25.326:** quien maneja una base con datos personales tiene que inscribirla en el Registro Nacional de Bases de Datos (Agencia de Acceso a la Información Pública). Consultalo antes de abrir a usuarios.
- Si cobrás Pro, vas a necesitar facturarle a tus usuarios. Facti puede emitir esas facturas con tu propio CUIT.

## 10. Después de lanzar

- Mirá los logs de la API en Vercel la primera semana, sobre todo los avisos "comprobante autorizado sin guardar" (ARCA autorizó pero no se pudo guardar).
- Vencimiento del certificado: los de producción duran **2 años**. Agendá renovarlo un mes antes.
- Cada semestre (febrero y agosto) revisá que la tabla de categorías se haya actualizado sola (en `/monotributo/categorias`).

---

## Lista para tildar

- [ ] Certificado de producción generado y descargado
- [ ] Certificado asociado a `wsfe` y `ws_sr_constancia_inscripcion`
- [ ] Copia segura de `produccion.key`
- [ ] Proyecto de Supabase de producción (y URL correcta en el `.env` local)
- [ ] Google: cliente OAuth, pantalla de consentimiento publicada, proveedor activado en Supabase
- [ ] Login con Google probado con tu cuenta y con la de otra persona
- [ ] Mercado Pago probado con usuarios de prueba (pago aprobado, rechazado, webhook y baja)
- [ ] Baja de Pro probada (sigue Pro hasta fin del mes pago) y resuelto el tema del email del pagador
- [ ] Credenciales de producción de Mercado Pago y un pago real con tu tarjeta
- [ ] Copias de seguridad de la base resueltas
- [ ] Variables de producción cargadas en Vercel (API y web)
- [ ] `FACTI_DEMO` y `NEXT_PUBLIC_DEMO` vacías
- [ ] Cron de recurrentes (o recurrentes solo manuales)
- [ ] Factura real con tu CUIT, PDF y QR revisados, anulada con nota de crédito
- [ ] Factura real con un segundo CUIT (prueba de la delegación)
- [ ] Base de datos inscripta (Ley 25.326)
