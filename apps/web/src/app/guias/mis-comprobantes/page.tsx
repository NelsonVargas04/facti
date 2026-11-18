'use client';

import { Suspense } from 'react';
import { PaginaGuia } from '@/components/guia/PaginaGuia';
import { EscenarioMisComprobantes, duracionMisComprobantes } from '@/components/guia/RecorridoMisComprobantes';

export default function GuiaMisComprobantes() {
  return (
    <Suspense>
      <PaginaGuia
        titulo="Sumá lo que facturaste fuera de Facti"
        bajada="Bajá tus comprobantes emitidos de los últimos 12 meses en ARCA y subilos a Facti, así tus topes del monotributo son exactos. Podés pausarlo y verlo más lento."
        total={duracionMisComprobantes()}
        cuadro={(t) => <EscenarioMisComprobantes t={t} />}
        mp4="/videos/mis-comprobantes.mp4"
        volver={{ href: '/app/monotributo/pagos', texto: 'Volver a Monotributo' }}
      />
    </Suspense>
  );
}
