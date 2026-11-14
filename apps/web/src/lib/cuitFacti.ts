/** CUIT de Facti: es el "representante" al que cada usuario le delega la facturación en ARCA
 *  (el dueño del certificado). Se configura con NEXT_PUBLIC_CUIT_FACTI. */
export const CUIT_FACTI = (() => {
  const c = (process.env.NEXT_PUBLIC_CUIT_FACTI ?? '').replace(/\D/g, '');
  return c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : '20-96037763-0';
})();
