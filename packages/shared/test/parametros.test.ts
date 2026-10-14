import { describe, expect, it } from 'vitest';
import { obtenerParametro } from '../src/parametros.js';

describe('parámetros normativos', () => {
  it('devuelve el plazo FCE según la fecha', () => {
    expect(obtenerParametro('fce.plazo_aceptacion_dias', new Date('2026-10-14'))).toBe(21);
    expect(obtenerParametro('fce.plazo_aceptacion_dias', new Date('2026-11-05'))).toBe(15);
  });
  it('falla si no hay valor vigente', () => {
    expect(() => obtenerParametro('fce.monto_minimo', new Date('2020-01-01'))).toThrow();
  });
});
