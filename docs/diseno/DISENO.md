# Sistema de diseño de Facti

Referencia para implementar `apps/web`. Las pantallas originales están en `pantallas/` (HTML de los mockups,
usar como referencia visual y de contenido, no copiar el código tal cual) y la mascota en `facti/` (SVG listos para usar).

## Estilo
"Playful / soft UI": amigable y cercano en la landing y el onboarding; más sobrio y claro en las pantallas de trabajo
(emitir, listar, pagar). Los comprobantes PDF siguen el **formato oficial de ARCA**.

## Colores
| Token | Valor | Uso |
| --- | --- | --- |
| `fondo` | `#F2F5F9` | Fondo general |
| `superficie` | `#FFFFFF` | Tarjetas, menú lateral |
| `texto` | `#15193A` | Texto principal, botones oscuros |
| `texto-suave` | `#4A5072` | Texto secundario |
| `texto-tenue` | `#5A6080` | Etiquetas, notas |
| `borde` | `#DCE1EC` | Bordes de inputs y botones secundarios |
| `primario` | `#3B3FD8` | Botones principales, links, acentos |
| `primario-oscuro` | `#2A2DB0` | Texto sobre `primario-suave` |
| `primario-suave` | `#ECEDFF` | Ítem activo del menú, etiquetas de tipo de factura |
| `acento` | `#FFD25E` | Resaltados, subrayado tipo marcador, botón sobre fondo oscuro |
| `aviso-suave` / `aviso-texto` | `#FFF3D1` / `#6B4600` | Vencimientos, pendientes |
| `exito-suave` / `exito-texto` | `#D7F5E6` / `#0E5C38` | "Autorizada por ARCA", cobrada |
| `exito` | `#1E9E63` | Puntos y tildes de estado |
| `error` / `error-suave` | `#B42344` / `#FDECEF` | Errores de formulario (borde, mensaje y anillo de foco) |
| `facti-cuerpo` | `#7B7FF2` | Solo la mascota |

## Tipografía
- Títulos: **Quicksand** 700 (H1 34–68 px, H2 20–44 px), interletrado -0.02em en tamaños grandes.
- Texto: **Nunito** 400/600/700/800, 16–17 px, interlineado 1.55.
- Etiquetas en mayúsculas: 12–13 px, 800, interletrado 0.06em.

## Formas
- Radios: inputs 14 px · tarjetas 22–28 px · botones `999px` (píldora).
- Sombra de tarjeta: `0 8px 24px rgba(21,25,58,0.06)`; destacada: `0 20px 50px rgba(21,25,58,0.12)`.
- Botón principal: fondo `primario`, texto blanco 800, alto 52–54 px, sombra `0 10px 24px rgba(59,63,216,0.25)`.
- Landing: tarjetas y etiquetas levemente rotadas (−4° a 3°) estilo sticker. **No** en las pantallas de trabajo.

## Componentes clave
- **Menú lateral** (app): logo, botón "Emitir factura", navegación (Inicio, Facturas, Clientes, Cobros, Monotributo, Configuración) y al pie el estado "Conectado a ARCA" con CUIT y punto de venta.
- **Etiqueta de comprobante**: letra en cuadrado (A/B/C/M/E) + nombre.
- **Estado ARCA**: chip verde "Autorizada" con tilde; CAE y vencimiento visibles.
- **Estado de cobro**: chip "Cobrada" (verde) o "Pendiente" (amarillo).
- **Datos del padrón**: caja gris con "Encontrado en el padrón de ARCA" y los datos del CUIT.
- **Stepper de onboarding**: 5 pasos (Tu perfil, Clave fiscal, Autorizar en ARCA, Punto de venta, ¡Listo!).
- **Aviso legal** en registro y onboarding: "Facti es una herramienta complementaria y de ayuda. No es ARCA ni un organismo oficial."

## Mascota Facti
Siempre el mismo personaje: ticket lila con borde en zigzag, manos amarillas, cachetes rosados. SVG en `facti/`.

| Pose | Archivo | Dónde | Animada |
| --- | --- | --- | --- |
| Saludando | `facti-saludo.svg` | Landing, crear cuenta | Sí: flota y mueve los brazos |
| Todo bien | `facti-ok.svg` | Confirmaciones | No |
| Festejando | `facti-festejo.svg` | Factura emitida, onboarding listo | Sí: confeti |
| Con una factura | `facti-factura.svg` | Emitir factura | No |
| Pensando | `facti-pensando.svg` | Ayuda | No |
| Señalando | `facti-senalando.svg` | Autorizar en ARCA, tips | No |
| Buscando en ARCA | `facti-buscando.svg` | Perfil fiscal, cargas | Sí: mueve la lupa |
| Atento | `facti-alerta.svg` | Inicio (quieto), vencimientos (animado) | Según pantalla |
| Esperando | `facti-durmiendo.svg` | ARCA caída, pantallas vacías | Sí: "z" que suben |

Reglas: una sola pose animada por pantalla; las animaciones se apagan con `prefers-reduced-motion`; no cambiar colores ni proporciones.
En React conviene un componente `<Facti pose="festejo" size={160} animated />` que tome el SVG de la pose y agregue
las clases de animación (flotar, parpadear, saludar, confeti, etc. — ver `pantallas/facti-componente.html`).

## Pantallas y rutas sugeridas
| Mockup | Ruta |
| --- | --- |
| 01-landing | `/` |
| 02-crear-cuenta | `/registro` |
| 03-onboarding-perfil-fiscal | `/onboarding/perfil` |
| 04-onboarding-autorizar-arca | `/onboarding/arca` |
| 05-inicio | `/app` |
| 06-emitir-factura | `/app/facturas/nueva` |
| 07-factura-emitida | `/app/facturas/[id]` |
| 08-pagos-monotributo | `/app/monotributo/pagos` |
| pdf-factura-a / c / e | Plantillas del PDF del comprobante |

Pendientes de diseñar: onboarding pasos 2 (clave fiscal) y 4 (punto de venta), listado de facturas, clientes, cobros, configuración.
