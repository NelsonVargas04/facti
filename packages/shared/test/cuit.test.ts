import { describe, expect, it } from 'vitest';
import { formatearCuit, validarCuit } from '../src/cuit.js';

describe('CUIT', () => {
  it('acepta un CUIT válido con o sin guiones', () => {
    expect(validarCuit('20-12345678-6')).toBe(true);
    expect(validarCuit('20123456786')).toBe(true);
  });
  it('rechaza dígito verificador incorrecto y largos inválidos', () => {
    expect(validarCuit('20-12345678-5')).toBe(false);
    expect(validarCuit('2012345678')).toBe(false);
  });
  it('formatea', () => {
    expect(formatearCuit('20123456786')).toBe('20-12345678-6');
  });
});
