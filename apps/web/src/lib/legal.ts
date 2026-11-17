/**
 * Datos del titular de Facti y de los textos legales. Están en un solo lugar para que sea fácil
 * completarlos y revisarlos con un abogado. Lo que dice "[A COMPLETAR …]" falta definir antes de
 * abrir Facti al público.
 */
export const LEGAL = {
  /** Persona humana titular del servicio (por ahora Facti no es una sociedad). */
  titular: 'Nelson Eduardo Vargas Planas',
  cuit: '20-96037763-0',
  domicilio: '[A COMPLETAR: domicilio legal]',
  email: '[A COMPLETAR: email de contacto]',
  /** Área que atiende consultas y reclamos (Disposición 954/2025, art. 6). */
  atencion: 'Atención al usuario de Facti',
  /** Horario de atención: al menos 8 horas en días hábiles si es solo por canales electrónicos. */
  horario: 'de lunes a viernes de 9 a 18 h (hora de Argentina)',
  /** Última actualización de los Términos y la Política de Privacidad. */
  actualizado: '17 de noviembre de 2026',
  /** Formulario oficial de denuncias (Ventanilla Federal Única de Defensa del Consumidor). */
  defensaConsumidor: 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario',
  /** Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326. */
  aaip: 'https://www.argentina.gob.ar/aaip/datospersonales',
} as const;

/** true mientras falte completar algún dato del titular. */
export const LEGAL_INCOMPLETO = Object.values(LEGAL).some((v) => v.includes('[A COMPLETAR'));
