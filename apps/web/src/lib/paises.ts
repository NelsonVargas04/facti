/**
 * Todos los países del mundo (códigos ISO 3166-1 alfa-2), con el nombre en español que da el
 * navegador (Intl.DisplayNames) y en orden alfabético. Sin Argentina: es para la Factura E (exportación).
 *
 * Ojo: para emitir la Factura E, ARCA usa su propia tabla de países (WSFEX, FEXGetPARAM_DST_pais);
 * cuando se integre WSFEX hay que mapear estos códigos a los de ARCA.
 */
const CODIGOS = (
  'AD AE AF AG AI AL AM AO AQ AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

let cache: { codigo: string; nombre: string }[] | null = null;

export function paises(): { codigo: string; nombre: string }[] {
  if (cache) return cache;
  let nombres: Intl.DisplayNames | null = null;
  try {
    nombres = new Intl.DisplayNames(['es-AR', 'es'], { type: 'region' });
  } catch {
    nombres = null;
  }
  cache = CODIGOS.map((codigo) => ({ codigo, nombre: nombres?.of(codigo) ?? codigo }))
    .filter((p) => p.nombre && p.nombre !== p.codigo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return cache;
}
