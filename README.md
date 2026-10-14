# Facti

Herramienta complementaria y de ayuda para facturar en ARCA: facturas A, B, C, M y E, panel de monotributo y cobros, desde un solo lugar.

> Facti no es ARCA ni un organismo oficial. Los comprobantes los autoriza siempre ARCA.

## Estado

Primera pieza del MVP: el paquete `@facti/arca`, que se conecta con los web services oficiales.

| Servicio de ARCA | Estado |
| --- | --- |
| WSAA (autenticación con certificado) | Listo para probar |
| WSFEv1 (facturas A, B, C, M y notas) | Listo para probar |
| Padrón A5 (constancia de inscripción) | Listo para probar |
| QR del comprobante | Listo |
| WSFEX (Factura E) | Próximo paso |

## Estructura

```
packages/
  arca/     Conexión con ARCA: WSAA, WSFEv1, padrón, QR y tablas de códigos
  shared/   Validación de CUIT y parámetros normativos con fecha de vigencia
scripts/    Pruebas manuales contra homologación
docs/       Decisiones técnicas
certs/      Certificados locales (ignorados por git)
```

Próximas carpetas: `apps/api` (backend con cola de emisión), `apps/web` (Next.js) y, más adelante, `apps/mobile` (Expo).

## Requisitos

- Node.js 20.6 o superior
- CUIT con clave fiscal nivel 3 (para el certificado de homologación)

## Primeros pasos

```bash
npm install
npm test
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
npm run arca:probar                 # estado de ARCA, puntos de venta y último número
npm run arca:padron -- 20123456786  # datos de un CUIT del padrón
npm run arca:factura-c              # emite una Factura C de prueba y muestra CAE y QR
```

## Reglas del proyecto

- Nunca pedir ni guardar la clave fiscal del usuario: se usa la delegación del web service al CUIT de Facti.
- Certificados y claves privadas fuera del repo; en producción, en un gestor de secretos.
- Una emisión a la vez por punto de venta y tipo. Si ARCA no responde, consultar antes de reintentar.
- Montos, plazos y escalas que fija la normativa van en `packages/shared/src/parametros.ts` con su fuente y vigencia, nunca fijos en el código.
- Guardar CAE, PDF y la respuesta de ARCA de cada comprobante durante 10 años.
