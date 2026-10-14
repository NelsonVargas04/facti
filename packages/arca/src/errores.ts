export interface DetalleArca {
  codigo: string;
  mensaje: string;
}

/** Error devuelto por un web service de ARCA (fault SOAP o lista de errores). */
export class ArcaError extends Error {
  constructor(
    message: string,
    public readonly detalles: DetalleArca[] = [],
    public readonly servicio?: string,
  ) {
    super(message);
    this.name = 'ArcaError';
  }
}

/** Fallo de red o timeout: no sabemos si ARCA recibió el pedido. */
export class ArcaSinRespuestaError extends Error {
  constructor(message: string, public readonly causa?: unknown) {
    super(message);
    this.name = 'ArcaSinRespuestaError';
  }
}
