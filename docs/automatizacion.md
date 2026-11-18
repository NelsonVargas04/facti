# Qué puede automatizar Facti para que no necesites contador en el día a día

> Relevamiento y plan al **17/11/2026**. Cubre todo lo que hoy le lleva un contador a una persona humana que factura,
> con foco en quienes venden servicios (profesionales, freelancers): facturación completa, llevar los números,
> monotributo, responsable inscripto, Ingresos Brutos y cobros del exterior.
>
> Facti es una ayuda: no reemplaza asesoramiento profesional ni es ARCA. Todo lo que figura acá respeta dos reglas que no cambian:
> **nunca pedimos ni guardamos la clave fiscal** (usamos la delegación del web service al CUIT de Facti) y **Facti no maneja ni mueve tu plata**.
> Tampoco damos consejos de inversión: cuando hablamos de dólares, es para registrar y calcular, no para recomendar qué hacer con ellos.

## Cómo leer este documento

Cada tarea tiene una de estas tres etiquetas:

| Etiqueta | Qué significa |
|---|---|
| **(a) Facti lo hace solo** | Hay un web service o API pública que Facti puede usar con la delegación (o con su propio certificado), o es un cálculo que Facti hace con tus datos. No entrás a ARCA. |
| **(b) Facti prepara, vos confirmás** | Solo se puede hacer en la web de ARCA, de tu provincia o de tu banco, con tu clave. Facti hace las cuentas, te dice exactamente qué cargar y te muestra un video guía. El último clic lo hacés vos. |
| **(c) Contador o fuera del alcance** | Hace falta criterio profesional, el riesgo es alto o no tiene sentido simplificarlo. Facti te avisa a tiempo y te recomienda consultar. |

**Sin confirmar** = no encontramos una fuente oficial que lo respalde. Hay que verificarlo antes de construir.

**Lo que descartamos de entrada:** hay productos que "automatizan" Mis Comprobantes, el Portal IVA o CCMA entrando a la web de ARCA con la clave fiscal del usuario (robots que simulan un navegador). Facti **no** lo hace: rompe la regla de la clave fiscal y es frágil.

---

## 1. Mapa de conexiones: qué existe y qué no

### ARCA

Fuente principal: [catálogo de web services de ARCA](https://www.arca.gob.ar/ws/documentacion/catalogo.asp).

| Servicio | Qué hace | ¿Lo puede usar Facti? | Estado en Facti |
|---|---|---|---|
| **WSAA** | Autenticación con certificado | Sí | Hecho (`apps/api/internal/arca/wsaa.go`) |
| **WSFEv1** (`wsfe`) | Facturas y notas A, B, C, M; consulta de lo emitido por Facti (`FECompConsultar`) | Sí, con delegación | Hecho, Factura C en homologación (`wsfe.go`) |
| **WSFEX** (`wsfex`) | Factura E de exportación, con cotización oficial (`FEXGetPARAM_Ctz`) | Sí, con delegación | Solo los códigos (`codigos.go`), falta el cliente |
| **WSFECred** | Factura de Crédito Electrónica MiPyME: saber si el receptor está obligado (`consultarMontoObligadoRecepcion`), aceptar, rechazar, informar cancelación ([documentación](https://docs.afipsdk.com/siguientes-pasos/web-services/factura-mipyme), [manual](https://tdn.totvs.com/download/attachments/533752339/Manual_Desarrollador_WSFECRED_v1.0.3-rc1.pdf?api=v2)) | Sí, con delegación | Fuera del MVP |
| **ws_sr_constancia_inscripcion** | Condición fiscal de cualquier CUIT: categoría de monotributo, impuestos, actividades, domicilio | Sí, con el certificado de Facti (sin delegación) | Hecho (`padron.go`). El catálogo marca `ws_sr_padron_a5` como **deprecado** y reemplazado por este servicio |
| **WSCDC** | Constatar que una factura recibida es válida | Sí | Fuera del MVP |
| **WSCCOMU** | Leer comunicaciones de la Ventanilla Electrónica (domicilio fiscal electrónico) | **Sin confirmar** si acepta un CUIT representado. No conseguimos el manual | No |
| **SETIWS-PAGO-API** | Crear y consultar VEP | **No**: según su [manual](https://www.afip.gob.ar/ws/SETIWS-PAGO-API/Manual_para_el_desarrollador_setiws-pago-api.pdf), es exclusivo de organismos con convenio con ARCA | No aplica |
| **sud_restricciones** | Deuda por CUIT | **No**: reservado a bancos | No aplica |
| "Presentación de DDJJ" | Figura en el catálogo sin manual público | **Sin confirmar** a quién está habilitado | No |

**Sin web service** (solo por la web, con clave fiscal):
- **Mis Comprobantes**: no encontramos API para las facturas emitidas ni para las recibidas. Hay que bajar el CSV.
- **Portal IVA / Libro IVA Digital**, las DDJJ de Ganancias y de Bienes Personales, **Mis Retenciones**, CCMA (deuda y pagos del monotributo), recategorización, actividades, domicilio y puntos de venta.

### Provincias y Comisión Arbitral

- **SIFERE Web** (Convenio Multilateral), SIRCREB (retenciones bancarias), SIRCAR, SIRTAC y el Padrón Web se usan por el [Portal Federal Tributario](https://www.iprofesional.com/impuestos/427255-impuestos-sobre-los-ingresos-brutos-ingreso-al-portal-federal-tributario), con usuario y clave de ARCA. No encontramos una API pública para contribuyentes.
- **ARBA, AGIP y demás agencias provinciales**: los trámites de los contribuyentes van por su web, con CUIT y clave (en ARBA, la CIT). Ver por ejemplo el [instructivo de deducciones de ARBA](https://www.arba.gov.ar/archivos/Publicaciones/InstructivoConsultaycargadededucciones.pdf). No encontramos APIs públicas para presentar ni pagar.

### Otras fuentes públicas útiles

- **Cotización oficial del dólar**: ARCA la da por WSFEX (para la Factura E) y el BCRA publica las cotizaciones en su API pública de Estadísticas Cambiarias. **Sin confirmar** la URL y las condiciones de uso vigentes. Para el dólar MEP no hay fuente oficial en tiempo real: si se muestra, hay que aclarar de dónde sale.
- **Tabla de categorías del monotributo**: Facti ya la lee de [arca.gob.ar/monotributo/categorias.asp](https://www.arca.gob.ar/monotributo/categorias.asp) (`apps/api/internal/monotributo/categorias.go`).
- **QR de las facturas recibidas**: todo comprobante electrónico trae un QR con CUIT, tipo, número, importe, moneda, cotización y CAE. Facti ya sabe leerlo (`qr.go`, `leerUrlQR`). Con una foto o el PDF de una factura de un proveedor, se cargan los datos solos y se pueden constatar con WSCDC.

---

## 2. Facturación completa

### Qué comprobante va en cada caso

Facti lo elige solo, consultando la condición fiscal del emisor y la del receptor con `ws_sr_constancia_inscripcion` **(a)**.

| Emisor | Receptor | Comprobante | Detalle |
|---|---|---|---|
| Monotributista o exento | Cualquiera | **C** | No discrimina IVA |
| Responsable inscripto | Responsable inscripto | **A** | Discrimina IVA por alícuota |
| Responsable inscripto | Monotributista | **A** con leyenda Ley 27.618 | Pago a la CBU del emisor |
| Responsable inscripto | Consumidor final, exento, no alcanzado | **B** | IVA incluido en el precio |
| Responsable inscripto observado por ARCA (por ej. al darse de alta, RG 1575) | RI o monotributista | **M** (o A "sujeta a retención") | **Sin confirmar** cómo detectarlo por web service. ARCA lo comunica al contribuyente; Facti tendría que preguntarlo |
| Cualquiera | Cliente del exterior | **E** (WSFEX) | Exportación, IVA exento |
| MiPyME | "Gran empresa" obligada, desde $5.549.862 | **FCE A, B o C** (WSFECred) | Facti lo sabe con `consultarMontoObligadoRecepcion` |

**Notas de crédito y débito:** son del mismo tipo que la factura original (NC C para una C, etc.) y llevan el comprobante asociado. Facti las arma desde la factura con un clic: anular total, parcial o ajustar un precio **(a)**.

### Datos obligatorios (RG 1415 y RG 4291)

Facti los completa solo a partir del padrón y del perfil **(a)**:
- **Del emisor:** nombre, domicilio comercial, CUIT, condición frente al IVA, número de Ingresos Brutos, inicio de actividades.
- **Del receptor:** tipo y número de documento, nombre, domicilio y **condición frente al IVA (obligatoria desde la RG 5616)**. A consumidor final, se identifica obligatoriamente desde $10.000.000 (RG 5700/2025).
- **Del comprobante:** punto de venta y número correlativo, fecha, concepto (productos, servicios o ambos), detalle, importes. En servicios: período facturado y vencimiento del pago.
- **De ARCA:** CAE con su vencimiento y código QR.

Los montos y umbrales van en `packages/shared/src/parametros.ts` con fuente y vigencia, como ya está previsto.

### Factura de Crédito Electrónica MiPyME (FCE)

- **Emitir:** cuando el cliente es una "gran empresa" inscripta en el registro y la factura supera $5.549.862 (desde el 14/04/2026), va FCE en lugar de A/B/C. Con WSFECred, Facti puede consultar si corresponde y emitir **(a)**.
- **Seguir la factura:** el receptor tiene 21 días corridos para aceptarla o rechazarla; si no hace nada, queda aceptada ([FAQ de ARCA](https://servicioscf.afip.gob.ar/facturadecreditoelectronica/preguntasFrecuentes/receptor-factura.asp), [guía paso a paso](https://serviciosweb.afip.gob.ar/genericos/guiasPasoPaso/VerGuia.aspx?id=301)). El plazo pasa a 15 días después del 31/10/2026 si no hubo prórroga (ver `CLAUDE.md`): **hay que confirmar qué rige hoy**. Facti puede mostrar el estado y avisar **(a)**.
- **Negociarla** (descontarla en un banco o en el mercado de capitales): **(c)**, fuera del alcance.
- Para la fase 1 (personas humanas que venden servicios) es raro, por eso queda para después.

### Facturas que recibís (proveedores, gastos)

| Tarea | ¿Web service? | Etiqueta | Cómo |
|---|---|---|---|
| Cargar una factura recibida | No hay API de Mis Comprobantes recibidos | **(a)** con el QR / **(b)** con el CSV | Subís el PDF o una foto y Facti lee el QR. O bajás el CSV de "Mis Comprobantes – Recibidos" y Facti lo importa con todo el mes de una vez. |
| Verificar que la factura sea válida | WSCDC | **(a)** | Constatación automática al cargarla. |
| Avisarte de facturas que te hicieron y no cargaste | No | **(b)** | Solo comparando con el CSV importado. |

### Facturas emitidas fuera de Facti

Si facturaste desde la web de ARCA o con otra app, Facti no lo ve: `FECompConsultar` solo consulta por punto de venta y número. Solución: importar el CSV de "Mis Comprobantes – Emitidos" **(b)**, o consultar uno por uno los puntos de venta web service del usuario con `FECompUltimoAutorizado` + `FECompConsultar` **(a)** (sirve solo para puntos de venta de web service, no para los de "Comprobantes en línea").

### Libro IVA

- **Monotributista:** no lleva libro IVA.
- **Responsable inscripto:** desde noviembre de 2025 la DDJJ mensual se hace en el **Portal IVA** con el **F. 2051** ("IVA Simple", RG 5705/2025), que toma los comprobantes de ARCA. El F. 2002 con importación de TXT quedó para períodos anteriores ([Cronista](https://www.cronista.com/columnistas/iva-simple-en-que-consiste-el-nuevo-sistema-de-arca-para-las-declaraciones-juradas), [Blog del Contador](https://blogdelcontador.com.ar/news-45985-iva-simple-paso-a-paso-arca-lanzo-una-guia-y-un-micrositio-del-nuevo-portal-iva)). No hay web service público para presentarla.
- **Exento:** sigue con el Libro IVA Digital (RG 5707/2025, [ARCA](https://www.arca.gob.ar/libro-iva-digital)).
- Facti puede armar el **libro de ventas y compras** con lo emitido y lo cargado, y mostrarte antes de que entres al Portal IVA cuánto te da el IVA del mes y si falta algún comprobante **(b)**.

---

## 3. Llevar los números

Ninguna de estas tareas necesita a ARCA: es ordenar datos que Facti ya tiene o que vos le das. Es donde más valor podemos dar con poco riesgo.

| Tarea | Etiqueta | Cómo |
|---|---|---|
| Ingresos del mes y del año | **(a)** | Sale de las facturas emitidas, en pesos y en moneda original. |
| Gastos | **(a)** con QR / **(b)** con CSV | Facturas recibidas, más gastos sin factura cargados a mano (con categoría). El monotributista no los deduce, pero le sirven para saber cuánto gana y para un control de exclusión (compras e inversiones en relación con lo que factura). |
| Cobros pendientes y vencidos | **(a)** | Ya existe marcar cobrada o pendiente. Sumar el vencimiento del pago y los recordatorios (Pro). |
| Conciliación de cobros | **(b)** | Hoy, a mano. Más adelante: importar el extracto del banco o de la billetera (CSV) y sugerir qué factura pagó cada ingreso. Las APIs de billeteras con permiso de solo lectura del usuario son una opción a evaluar; **nunca** permisos para mover plata. |
| Reporte mensual | **(a)** | Facturado, cobrado, pendiente, gastos, "te queda", cuota del monotributo o IVA estimado, margen hasta el tope. |
| Reporte anual | **(a)** | El año en un resumen, con los datos que te va a pedir un contador o una DDJJ (ingresos por mes, por cliente, del exterior). |
| Información para decidir | **(a)** | Cuánto podés facturar este mes sin cambiar de categoría; qué clientes pagan tarde; cuánto viene del exterior; cuándo te conviene empezar a pensar en pasarte a responsable inscripto (con aviso de consultar). |
| Guardar todo 10 años | **(a)** | Ya está previsto: CAE, PDF y respuesta de ARCA. Sumar las facturas recibidas. |

---

## 4. Monotributo

| Tarea | ¿Web service? | Etiqueta | Cómo |
|---|---|---|---|
| Ver cuánto pagás por mes | No (la tabla es pública) | **(a)** | Ya está: la cuota de tu categoría con la tabla oficial. |
| Generar el VEP o QR y pagar | No | **(b)** | Video guía ya hecho (`guias/pagar-monotributo`). Facti no paga ni toca tu plata. |
| Confirmar que quedó pago | No | **(b)** | Subís el PDF del pago y Facti lo lee (pendiente en el MVP). |
| Recordar el vencimiento (día 20) | — | **(a)** | Mail o notificación. |
| Deuda vieja | No (CCMA, solo web) | **(b)** / **(c)** | Video de cómo verla en CCMA ([iProfesional](https://www.iprofesional.com/impuestos/452072-arca-como-consultar-deuda-de-monotributo-paso-a-paso)). Con intimaciones o planes de pago complicados, **(c)**. |
| Débito automático | No | **(b)** | Guía. |
| Facturado en 12 meses y margen hasta el tope | — | **(a)** | La barra de tope ya existe. Falta sumar lo emitido fuera de Facti. |
| Recategorización (enero y julio, vence el 5) | No | **(b)** | Facti calcula la categoría y te dice qué cargar; video guía ya hecho (`guias/recategorizacion`). Calendario 2026: [ARCA](https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5497). **Sin confirmar** la fecha exacta de enero de 2027. |
| Alquileres, energía y superficie de la recategorización | No | **(b)** | Facti los pregunta una vez y los recuerda. |
| Detectar una recategorización de oficio | Parcial: el padrón muestra la categoría | **(a)** detectar / **(b)** disconformidad | Procedimiento simplificado de disconformidad desde 2026 ([iProfesional](https://www.iprofesional.com/impuestos/449803-como-funciona-el-nuevo-procedimiento-para-reclamar-ante-la-recategorizacion-de-oficio)). |
| Causales de exclusión que Facti ve (ingresos por encima de la K, precio unitario máximo) | — | **(a)** | ARCA usa tablas de exclusión distintas a las de recategorización ([iProfesional](https://www.iprofesional.com/impuestos/446225-tabla-monotributo-aplica-arca-para-exclusiones-2026)): hay que cargar ambas. |
| Causales que Facti no ve (gastos personales, depósitos) | No | **(c)** | Facti lo explica, no tiene los datos. |
| Detectar que te excluyeron | Padrón | **(a)** | Chequeo periódico y aviso. |
| Pasarte a responsable inscripto | No | **(c)** | Facti te avisa con tiempo. |
| Constancia de inscripción y credencial | Padrón (los datos); PDF en ARCA | **(a)** / **(b)** | [ARCA, constancias](https://www.arca.gob.ar/monotributo/ayuda/constancias-y-credenciales.asp). |
| Alta o baja de actividad, domicilio, baja del monotributo | No | **(b)** | Guías. Facti avisa si facturás algo que no coincide con tus actividades. |
| DDJJ informativa del monotributo | — | — | **Sin confirmar** que hoy exista alguna obligatoria para personas humanas. |

---

## 5. Responsable inscripto (persona humana)

| Tarea | ¿Web service? | Etiqueta | Cómo |
|---|---|---|---|
| Facturas A, B, M con IVA por alícuota, notas | WSFEv1 | **(a)** | Fase de responsable inscripto del MVP. |
| IVA mensual (F. 2051 en Portal IVA) | No | **(b)** | Facti arma el débito fiscal (ventas) y el crédito fiscal (compras cargadas), te muestra el saldo estimado y te guía para confirmar en Portal IVA. Vencimiento según terminación del CUIT. |
| Percepciones y retenciones de IVA y Ganancias que te hicieron | No (Mis Retenciones es web) | **(b)** / **(c)** | Facti puede tomar las percepciones que vienen en las facturas recibidas. Las retenciones de tus clientes se ven en "Mis Retenciones": guía. Si sos agente de retención, **(c)**. |
| Ganancias anual | No | **(b)** si estás en el régimen simplificado / **(c)** si no | Desde 2026 existe la **DDJJ simplificada de Ganancias** con datos precargados por ARCA (Ley 27.799, Decreto 93/2026, RG 5820/2026, ampliada por la RG 5916/2026): revisás, confirmás y pagás, y tiene efecto liberatorio ([RG 5820/2026](https://www.argentina.gob.ar/normativa/nacional/norma-423037/texto), [ARCA](https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5982), [Blog del Contador](https://blogdelcontador.com.ar/news-46457-declaracion-jurada-simplificada-de-ganancias-como-funciona-el-nuevo-sistema-reglamentado-por-arca)). Facti puede comparar los ingresos precargados con los suyos y mostrar diferencias antes de confirmar. Fuera de ese régimen, contador. |
| Anticipos de Ganancias | No | **(a)** recordatorio / **(c)** cálculo y reducción | Facti recuerda los vencimientos; pedir reducción de anticipos es tema de contador. |
| Bienes Personales | No | **(c)** | Facti avisa que existe y te da el resumen de saldos que tiene; la DDJJ queda para un contador. |
| Exportación de servicios: IVA y recupero | — | **(c)** | La exportación no paga IVA, pero recuperar el IVA de las compras asociadas es un trámite técnico. |

El mensaje honesto: **Facti te ahorra el contador del día a día. El cierre anual de un responsable inscripto, salvo que estés en el régimen simplificado de Ganancias, sigue siendo cosa de un contador.**

---

## 6. Ingresos Brutos (provincial)

| Situación | ¿API? | Etiqueta | Cómo |
|---|---|---|---|
| Monotributista en una jurisdicción con **Monotributo Unificado** | Va dentro de la cuota del monotributo | **(a)** | Facti te dice que ya está incluido según tu domicilio fiscal (del padrón). Según la prensa, son 13 provincias más CABA desde el 01/01/2026 ([argentina.gob.ar](https://www.argentina.gob.ar/node/488580), [Cronista](https://www.cronista.com/economia-politica/una-buena-para-los-monotributistas-la-novedad-de-arca-que-beneficiara-a-mas-de-200000-contribuyentes), [Contablix](https://contablix.ar/blog/monotributo-unificado-provincias-2026)). **Sin confirmar** la lista oficial (Santa Fe aparece en unas fuentes y no en otras). |
| Monotributista en una provincia con régimen simplificado propio (no unificado) | No encontramos APIs | **(b)** | Recordatorio y guía para esa provincia. |
| Régimen general local (por ej. ARBA, AGIP) | No encontramos APIs públicas para contribuyentes | **(b)** | Facti calcula la base imponible del mes (lo facturado por jurisdicción) y te guía para presentar en la web de la agencia. La alícuota depende de la actividad y de la ley impositiva de cada año: hay que cargarla con vigencia, o que el usuario la confirme. |
| Convenio Multilateral (vendés en varias provincias) | No (SIFERE Web, sin API pública) | **(c)** | El reparto entre jurisdicciones lleva criterio. Facti puede darte la facturación por provincia del cliente como ayuda. COMARB lanzó una modalidad simplificada para una sola actividad en dos jurisdicciones ([Blog del Contador](https://siap.blogdelcontador.com.ar/rubro_normativa/sifere-web/)); evaluar si se puede guiar. |
| Retenciones y percepciones de IIBB (incluidas las bancarias, SIRCREB) | No | **(b)** / **(c)** | Facti toma las percepciones de las facturas recibidas; las bancarias se ven en el Portal Federal Tributario. |
| Exportación de servicios en IIBB | — | **(c)** | El tratamiento cambia según la provincia (exenta o no). **Sin confirmar** por jurisdicción. |

---

## 7. Servicios: profesionales y freelancers

| Tarea | ¿Web service? | Etiqueta | Cómo |
|---|---|---|---|
| Factura E por exportación de servicios | WSFEX | **(a)** | País, ID fiscal del cliente, moneda, cotización, forma de pago; el mes va en la descripción. Cliente WSFEX pendiente. |
| Cotización del día para la factura | WSFEX (`FEXGetPARAM_Ctz`) | **(a)** | Facti la trae sola; la tabla de categorías se mide en pesos. |
| Cobros del exterior: registrar cuánto y cuándo cobraste, en qué moneda y por qué medio | — | **(a)** | Marcás la Factura E como cobrada con el importe neto recibido. Facti guarda la diferencia con lo facturado (comisiones de la plataforma). |
| ¿Tengo que liquidar los dólares a pesos? | — | Informativo | Desde la Comunicación "A" 8330 del BCRA (18/09/2025) no hay tope anual para no liquidar los cobros de exportación de servicios; las divisas igual tienen que ingresar al país en un plazo (20 días, corridos o hábiles según la fuente) ([Blog del Contador](https://blogdelcontador.com.ar/news-46223-freelancers-ahora-podran-cobrar-en-dolares-del-exterior-sin-limites-y-sin-obligacion-de-liquidarlos-a-pesos), [Allende](https://allende.com/bancario/el-banco-central-flexibiliza-el-regimen-cambiario-para-exportaciones-transferencias-en-moneda-extranjera-y-pagos-financieros-04-14-2026/)). **Sin confirmar** el texto vigente del BCRA. Facti lo explica y puede avisar si un cobro lleva muchos días sin registrar el ingreso, sin recomendar qué hacer con los dólares. |
| Dólar MEP vs. oficial | No hay fuente oficial en tiempo real del MEP | Informativo | Facti puede mostrar a qué cotización facturaste (oficial) y a cuánto vendiste si vos lo cargás. **No** recomienda cuándo ni cómo vender. |
| Diferencias de cambio en Ganancias | — | **(c)** | Para el responsable inscripto, es tema de contador. |
| Tope de categoría para servicios | — | **(a)** | Desde la Ley 27.743 (2024) los servicios pueden llegar hasta la categoría K (**confirmar** en la tabla vigente; algunas notas viejas todavía hablan de la H). |
| "Beneficios de exportador de servicios" (economía del conocimiento, recupero de IVA) | No | **(c)** | Facti informa que existen. |
| Retenciones de plataformas o clientes locales | No | **(b)** | Guía para ver "Mis Retenciones". |

---

## 8. Resumen por etiqueta

- **(a) Facti lo hace solo:** facturar todos los tipos (A, B, C, M, E, notas y FCE), elegir el tipo y completar los datos obligatorios, cargar facturas recibidas por QR y constatarlas, ingresos, gastos, cobros y reportes, topes y alertas del monotributo, vigilar el padrón, recordatorios de vencimientos, cotizaciones para la Factura E, decirte si el IIBB ya está en tu cuota.
- **(b) Facti prepara y vos confirmás:** pagar el monotributo, recategorizarte, importar Mis Comprobantes, IVA mensual en Portal IVA, Ganancias simplificada, IIBB local, trámites de padrón (actividades, domicilio, baja), conciliación con el extracto del banco.
- **(c) Contador o fuera del alcance:** pasaje a responsable inscripto, Ganancias por el régimen general, Bienes Personales, anticipos, Convenio Multilateral, recupero de IVA de exportación, diferencias de cambio, deudas complejas e intimaciones, agentes de retención.

**Conclusión:** ARCA solo deja automatizar la facturación y la consulta del padrón. Todo lo demás termina en un clic del usuario en una web oficial. Pero lo que hoy se le paga a un contador por mes (saber qué factura va, cuánto facturaste, cuánto debés, qué tenés que hacer y cuándo, y con qué números) se puede resolver casi todo con (a) y (b).

---

## 9. Plan priorizado (impacto ÷ esfuerzo)

Puntajes de 1 a 5. Impacto = cuánto contador o cuánto susto con ARCA te ahorra. Esfuerzo = trabajo con lo que ya existe.

| # | Función | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Topes con facturación completa (importar Mis Comprobantes) y alertas de categoría y exclusión | 5 | 2 | **2,5** |
| 2 | Calendario de vencimientos y recordatorios (monotributo, recategorización, IVA, IIBB) | 4 | 2 | **2,0** |
| 3 | Asistente de recategorización con la categoría ya calculada | 5 | 3 | **1,7** |
| 4 | Vigilancia del padrón (recategorización de oficio, exclusión, actividades) | 4 | 2,5 | **1,6** |
| 5 | Factura E con WSFEX y registro de cobros del exterior | 5 | 3,5 | **1,4** |
| 6 | Reporte mensual y anual (facturado, cobrado, pendiente, gastos, margen) | 4 | 3 | 1,3 |
| 7 | Facturas recibidas por QR y constatación con WSCDC | 3 | 3 | 1,0 |
| 8 | Confirmar el pago del monotributo leyendo el PDF del VEP | 3 | 3 | 1,0 |
| 9 | IIBB según tu provincia (unificado, simplificado o local) | 3 | 3 | 1,0 |
| 10 | IVA mensual "listo para el Portal IVA" (responsable inscripto) | 4 | 4 | 1,0 |
| 11 | Avisos de la Ventanilla Electrónica (WSCCOMU), si se confirma | 4 | 4 | 1,0 |
| 12 | FCE MiPyME con WSFECred | 2 | 4 | 0,5 |

### Las 5 primeras, y qué necesita cada una

**1. Topes con facturación completa y alertas**
- Qué hace: suma lo facturado en los últimos 12 meses (en Facti y fuera de Facti), te dice en qué categoría estás "de hecho", cuánto te falta para el próximo tope y cuándo lo alcanzarías a tu ritmo. Avisa antes de pasar la K o un tope de exclusión.
- Necesita: importar el CSV de Mis Comprobantes (emitidos, y de paso recibidos) con un video de cómo bajarlo; cargar en `parametros.ts` las tablas de **exclusión** con su vigencia; una proyección simple por promedio mensual; aviso en el inicio y por mail.

**2. Calendario de vencimientos y recordatorios**
- Qué hace: un calendario tuyo con la cuota (día 20), la recategorización (enero y julio, vence el 5) y los cambios de escala; para el responsable inscripto, IVA y anticipos según la terminación del CUIT; IIBB según la provincia.
- Necesita: fechas en `parametros.ts` con fuente; envío de mails (después, push). Decisión de producto: que los recordatorios de **vencimientos fiscales** sean gratis (evitan multas y generan confianza) y los de **cobro** sigan siendo Pro.

**3. Asistente de recategorización**
- Qué hace: en enero y julio te dice "te corresponde la categoría X" con tus números (12 meses + alquileres + energía + superficie), te arma una ficha con qué cargar en cada pantalla de ARCA y te lleva al video que ya existe. Si no cambiás de categoría, te lo dice.
- Necesita: la función 1; un formulario único para los datos que no son facturación (Facti los recuerda); revisar que el video de `guias/recategorizacion` coincida con la ficha.

**4. Vigilancia del padrón**
- Qué hace: una vez por semana consulta tu constancia de inscripción y te avisa si cambió tu categoría (recategorización de oficio), tu condición (exclusión, baja, alta en IVA) o tus actividades. Si te recategorizaron de oficio, te guía con la disconformidad.
- Necesita: tarea programada en la API que llame a `ConsultarPadron` y guarde una foto por cuenta; comparación y alertas. Validar en homologación el formato de `datosMonotributo` (ya está en pendientes de `CLAUDE.md`) y asegurarse de usar `ws_sr_constancia_inscripcion` y no el alcance 5 deprecado.

**5. Factura E y cobros del exterior**
- Qué hace: factura de exportación de servicios (país, ID del exterior, moneda, cotización del día, forma de pago) y registro del cobro: monto recibido, comisiones, fecha. Suma al tope del monotributo en pesos.
- Necesita: cliente WSFEX en `apps/api/internal/arca` (mismo patrón que `wsfe.go`: bloqueo por punto de venta y consulta antes de reintentar), tablas de países y monedas, PDF de Factura E (el diseño ya existe), autorizar `wsfex` en la delegación (agregarlo al video de conexión) y un texto informativo sobre el ingreso de divisas, revisado contra el BCRA.

### Para investigar antes de seguir
- **WSCCOMU**: conseguir el manual y confirmar si acepta un CUIT representado.
- **"Presentación de DDJJ"** del catálogo de ARCA: a quién está habilitado.
- Si existe alguna forma de consultar **Mis Comprobantes** por web service (hoy no encontramos ninguna).
- **Factura M**: cómo saber, sin la clave fiscal, si el emisor tiene que usarla.
- Lista oficial de jurisdicciones con **Monotributo Unificado** y tratamiento de la exportación de servicios en IIBB por provincia.
- Texto vigente del **BCRA** sobre cobros de exportación de servicios (plazo de ingreso).
- Plazo vigente de aceptación de la **FCE** (21 o 15 días) después del 31/10/2026.
- API de cotizaciones del **BCRA**: URL y condiciones de uso.

---

## Fuentes

**ARCA, web services**
- Catálogo: https://www.arca.gob.ar/ws/documentacion/catalogo.asp
- SETIWS-PAGO-API (VEP, solo organismos con convenio): https://www.afip.gob.ar/ws/SETIWS-PAGO-API/Manual_para_el_desarrollador_setiws-pago-api.pdf
- Constancia de inscripción: https://docs.afipsdk.com/siguientes-pasos/web-services/padron-de-constancia-de-inscripcion
- WSFECred: https://docs.afipsdk.com/siguientes-pasos/web-services/factura-mipyme y https://tdn.totvs.com/download/attachments/533752339/Manual_Desarrollador_WSFECRED_v1.0.3-rc1.pdf?api=v2

**Facturación e IVA**
- FCE, receptor: https://servicioscf.afip.gob.ar/facturadecreditoelectronica/preguntasFrecuentes/receptor-factura.asp
- FCE, guía paso a paso: https://serviciosweb.afip.gob.ar/genericos/guiasPasoPaso/VerGuia.aspx?id=301
- IVA Simple / Portal IVA: https://www.cronista.com/columnistas/iva-simple-en-que-consiste-el-nuevo-sistema-de-arca-para-las-declaraciones-juradas y https://blogdelcontador.com.ar/news-45985-iva-simple-paso-a-paso-arca-lanzo-una-guia-y-un-micrositio-del-nuevo-portal-iva
- Libro IVA Digital: https://www.arca.gob.ar/libro-iva-digital
- Liquidación electrónica mensual y Mis Comprobantes (ARCA): https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5560

**Monotributo**
- Tabla de categorías: https://www.arca.gob.ar/monotributo/categorias.asp
- Constancias y credenciales: https://www.arca.gob.ar/monotributo/ayuda/constancias-y-credenciales.asp
- Recategorización 2026: https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5497 y https://www.bloomberglinea.com/latinoamerica/argentina/recategorizacion-monotributo-2026-plazos-categorias-y-todo-lo-que-tenes-que-saber/
- Recategorización de oficio: https://www.iprofesional.com/impuestos/449803-como-funciona-el-nuevo-procedimiento-para-reclamar-ante-la-recategorizacion-de-oficio y https://blogdelcontador.com.ar/news-46463-recategorizacion-de-oficio-monotributo-nuevo-procedimiento-simplificado-para-manifestar-disconformidad
- Tablas de exclusión: https://www.iprofesional.com/impuestos/446225-tabla-monotributo-aplica-arca-para-exclusiones-2026
- Deuda (CCMA): https://www.iprofesional.com/impuestos/452072-arca-como-consultar-deuda-de-monotributo-paso-a-paso y https://www.ambito.com/informacion-general/deuda-monotributo-arca-la-guia-paso-paso-consultar-cuanto-debes-n6303937

**Ganancias**
- RG 5820/2026: https://www.argentina.gob.ar/normativa/nacional/norma-423037/texto
- ARCA, Inocencia Fiscal II: https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5982
- Explicación: https://blogdelcontador.com.ar/news-46457-declaracion-jurada-simplificada-de-ganancias-como-funciona-el-nuevo-sistema-reglamentado-por-arca

**Ingresos Brutos**
- Monotributo Unificado: https://www.argentina.gob.ar/node/488580 , https://www.cronista.com/economia-politica/una-buena-para-los-monotributistas-la-novedad-de-arca-que-beneficiara-a-mas-de-200000-contribuyentes , https://contablix.ar/blog/monotributo-unificado-provincias-2026
- Portal Federal Tributario: https://www.iprofesional.com/impuestos/427255-impuestos-sobre-los-ingresos-brutos-ingreso-al-portal-federal-tributario
- SIFERE Web: https://siap.blogdelcontador.com.ar/rubro_normativa/sifere-web/
- ARBA, deducciones: https://www.arba.gov.ar/archivos/Publicaciones/InstructivoConsultaycargadededucciones.pdf

**Exportación de servicios**
- Sin obligación de liquidar: https://blogdelcontador.com.ar/news-46223-freelancers-ahora-podran-cobrar-en-dolares-del-exterior-sin-limites-y-sin-obligacion-de-liquidarlos-a-pesos
- Régimen cambiario: https://allende.com/bancario/el-banco-central-flexibiliza-el-regimen-cambiario-para-exportaciones-transferencias-en-moneda-extranjera-y-pagos-financieros-04-14-2026/
