import { describe, expect, it } from 'vitest';
import { destinoSeguro } from './volver';

describe('destinoSeguro', () => {
  it('acepta rutas internas', () => {
    expect(destinoSeguro('/app/facturas?x=1')).toBe('/app/facturas?x=1');
  });
  it('rechaza otros sitios', () => {
    for (const v of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', null]) {
      expect(destinoSeguro(v)).toBe('/app');
    }
  });
});
