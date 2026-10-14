import forge from 'node-forge';
import { describe, expect, it } from 'vitest';
import { facturaSugerida, LEYENDA_LEY_27618, TIPOS_COMPROBANTE } from '../src/codigos.js';
import { aFechaArca } from '../src/fechas.js';
import { interpretarPersona } from '../src/padron.js';
import { leerUrlQR, urlQR } from '../src/qr.js';
import { crearTRA, firmarTRA } from '../src/wsaa.js';
import { armarSolicitud } from '../src/wsfe.js';

describe('tipo de factura sugerido', () => {
  it('monotributista siempre emite C', () => {
    expect(facturaSugerida('monotributo', 'responsable_inscripto').letra).toBe('C');
  });
  it('inscripto a monotributista: A con leyenda Ley 27.618', () => {
    const f = facturaSugerida('responsable_inscripto', 'monotributo');
    expect(f.tipo).toBe(TIPOS_COMPROBANTE.FACTURA_A);
    expect(f.leyenda).toBe(LEYENDA_LEY_27618);
  });
  it('inscripto a consumidor final: B', () => {
    expect(facturaSugerida('responsable_inscripto', 'consumidor_final').letra).toBe('B');
  });
});

describe('QR', () => {
  it('genera la URL oficial y se puede leer de vuelta', () => {
    const url = urlQR({
      fecha: '2026-10-12', cuit: 27314567894, ptoVta: 3, tipoCmp: 11, nroCmp: 128,
      importe: 85000, moneda: 'PES', ctz: 1, tipoDocRec: 80, nroDocRec: 30715896327,
      tipoCodAut: 'E', codAut: 76419283746521,
    });
    expect(url.startsWith('https://www.arca.gob.ar/fe/qr/?p=')).toBe(true);
    const datos = leerUrlQR(url);
    expect(datos.ver).toBe(1);
    expect(datos.codAut).toBe(76419283746521);
  });
});

describe('WSAA', () => {
  it('arma el TRA con el servicio pedido', () => {
    const tra = crearTRA('wsfe', new Date('2026-10-14T12:00:00Z'));
    expect(tra).toContain('<service>wsfe</service>');
    expect(tra).toContain('<generationTime>2026-10-14T11:50:00.000Z</generationTime>');
  });
  it('firma el TRA como CMS con un certificado', () => {
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    const attrs = [{ name: 'commonName', value: 'facti-test' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const cms = firmarTRA(crearTRA('wsfe'), forge.pki.certificateToPem(cert), forge.pki.privateKeyToPem(keys.privateKey));
    const der = forge.util.decode64(cms);
    // El TRA va embebido en el CMS (firma "attached"), como pide el WSAA.
    expect(der).toContain('<service>wsfe</service>');
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der)) as any;
    expect(p7.certificates).toHaveLength(1);
  });
});

describe('WSFEv1', () => {
  it('arma una Factura C de servicios sin IVA', () => {
    const xml = armarSolicitud(
      {
        puntoVenta: 3, tipo: 11, concepto: 2, docTipo: 80, docNro: '30715896327',
        condicionIvaReceptorId: 1, fecha: new Date('2026-10-12T15:00:00Z'),
        importeTotal: 85000, importeNeto: 85000,
        servicio: { desde: new Date('2026-10-01T15:00:00Z'), hasta: new Date('2026-10-31T15:00:00Z'), vencimientoPago: new Date('2026-10-24T15:00:00Z') },
      },
      128,
    );
    expect(xml).toContain('<ar:CbteDesde>128</ar:CbteDesde>');
    expect(xml).toContain('<ar:ImpTotal>85000.00</ar:ImpTotal>');
    expect(xml).toContain('<ar:FchServDesde>20261001</ar:FchServDesde>');
    expect(xml).toContain('<ar:CondicionIVAReceptorId>1</ar:CondicionIVAReceptorId>');
    expect(xml).not.toContain('<ar:Iva>');
  });
  it('usa la fecha de Argentina', () => {
    expect(aFechaArca(new Date('2026-10-15T01:00:00Z'))).toBe('20261014');
  });
});

describe('padrón', () => {
  it('detecta monotributo y categoría', () => {
    const d = interpretarPersona('27314567894', {
      datosGenerales: { apellido: 'FERNANDEZ', nombre: 'LUCIA', tipoPersona: 'FISICA' },
      datosMonotributo: { categoriaMonotributo: { descripcionCategoria: 'C LOCACIONES DE SERVICIO' } },
    });
    expect(d.condicion).toBe('monotributo');
    expect(d.nombre).toBe('FERNANDEZ LUCIA');
  });
  it('detecta responsable inscripto por el impuesto 30', () => {
    const d = interpretarPersona('30715896327', {
      datosGenerales: { razonSocial: 'ESTUDIO LUMEN SRL', tipoPersona: 'JURIDICA' },
      datosRegimenGeneral: { impuesto: [{ idImpuesto: '30' }, { idImpuesto: '10' }] },
    });
    expect(d.condicion).toBe('responsable_inscripto');
  });
});
