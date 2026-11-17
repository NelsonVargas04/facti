'use client';

import { Suspense } from 'react';
import { PaginaGuia } from '@/components/guia/PaginaGuia';
import { EscenarioPagoMonotributo, duracionPagoMonotributo } from '@/components/guia/RecorridoPagoMonotributo';

export default function GuiaPagarMonotributo() {
  return (
    <Suspense>
      <PaginaGuia
        titulo="Cómo pagar tu monotributo"
        bajada="Generá el VEP en ARCA, pagalo con el QR o por home banking y subí el comprobante a Facti. Despacio y con ejemplos; podés pausarlo y verlo más lento."
        total={duracionPagoMonotributo()}
        cuadro={(t) => <EscenarioPagoMonotributo t={t} />}
        mp4="/videos/pagar-monotributo.mp4"
        volver={{ href: '/app/monotributo/pagos', texto: 'Volver a Monotributo' }}
      />
    </Suspense>
  );
}
