import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal } from '@/components/legal/PaginaLegal';
import { FormSolicitud } from '@/components/legal/FormSolicitud';

export const metadata: Metadata = {
  title: 'Botón de baja de servicio · Facti',
  description: 'Dá de baja tu cuenta o el plan Pro de Facti, sin iniciar sesión.',
};

export default function Baja() {
  return (
    <PaginaLegal titulo="Botón de baja de servicio" bajada="Dá de baja tu cuenta o el plan Pro cuando quieras, sin iniciar sesión ni hacer trámites." conFecha={false}>
      <h2>Cómo funciona</h2>
      <ul>
        <li>Completá tu nombre y el email de tu cuenta y tocá <strong>Pedir la baja</strong>.</li>
        <li>Te mostramos en el momento un <strong>código de solicitud</strong>: es tu constancia.</li>
        <li>Hacemos efectiva la baja y desde ahí no se te cobra más.</li>
        <li>Antes de irte, te conviene descargar los PDF de tus comprobantes. Los que autorizó ARCA siguen siendo válidos.</li>
      </ul>
      <p>
        Si contrataste el plan Pro hace menos de 10 días, también podés usar el <Link href="/arrepentimiento">Botón de arrepentimiento</Link>{' '}
        y te devolvemos lo que pagaste.
      </p>
      <div className="mt-8">
        <FormSolicitud tipo="baja" />
      </div>
      <p className="mt-8 text-texto-tenue">Ley 24.240, art. 10 ter, y Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial.</p>
    </PaginaLegal>
  );
}
