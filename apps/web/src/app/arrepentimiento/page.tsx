import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal } from '@/components/legal/PaginaLegal';
import { FormSolicitud } from '@/components/legal/FormSolicitud';

export const metadata: Metadata = {
  title: 'Botón de arrepentimiento · Facti',
  description: 'Cancelá una contratación de Facti dentro de los 10 días, sin costo y sin iniciar sesión.',
};

export default function Arrepentimiento() {
  return (
    <PaginaLegal titulo="Botón de arrepentimiento" bajada="Tenés 10 días corridos desde que contrataste para arrepentirte, sin costo y sin dar explicaciones." conFecha={false}>
      <h2>Cómo funciona</h2>
      <ul>
        <li>Completá tu nombre y el email con el que contrataste y tocá <strong>Pedir el arrepentimiento</strong>. No hace falta iniciar sesión.</li>
        <li>Te mostramos en el momento un <strong>código de solicitud</strong>: es tu constancia.</li>
        <li>Cancelamos la contratación y te devolvemos lo que pagaste por el mismo medio de pago, sin costo.</li>
        <li>Los 10 días corridos se cuentan desde que contrataste el plan.</li>
      </ul>
      <p>
        Si lo que querés es dejar de usar Facti o cancelar el plan Pro después de esos 10 días, usá el{' '}
        <Link href="/baja">Botón de baja de servicio</Link>.
      </p>
      <div className="mt-8">
        <FormSolicitud tipo="arrepentimiento" />
      </div>
      <p className="mt-8 text-texto-tenue">
        Ley 24.240, art. 34; Código Civil y Comercial, art. 1110; Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y
        Lealtad Comercial.
      </p>
    </PaginaLegal>
  );
}
