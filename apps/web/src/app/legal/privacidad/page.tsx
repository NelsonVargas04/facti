import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal } from '@/components/legal/PaginaLegal';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de Privacidad · Facti',
  description: 'Qué datos guarda Facti, para qué los usa y cómo ejercer tus derechos (Ley 25.326).',
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de Privacidad" bajada="Qué datos guardamos, para qué y cómo podés pedir verlos, corregirlos o borrarlos.">
      <h2>1. Responsable de tus datos</h2>
      <p>
        El responsable de la base de datos es <strong>{LEGAL.titular}</strong>, CUIT {LEGAL.cuit}, con domicilio en {LEGAL.domicilio}.
        Contacto: {LEGAL.email}. Tratamos tus datos de acuerdo con la Ley 25.326 de Protección de los Datos Personales y sus normas
        complementarias.
      </p>
      <p>Base de datos inscripta en el Registro Nacional de Bases de Datos: [A COMPLETAR: número de inscripción ante la AAIP].</p>

      <h2>2. Qué datos guardamos</h2>
      <h3>Los que nos das vos</h3>
      <ul>
        <li><strong>Tu cuenta</strong>: nombre, email y contraseña. La contraseña la guarda nuestro proveedor de autenticación cifrada: nadie de Facti puede verla. Si entrás con Google, recibimos tu nombre y tu email.</li>
        <li><strong>Tus datos fiscales</strong>: CUIT y, desde el padrón de ARCA (o cargados por vos), nombre o razón social, domicilio fiscal, condición frente al IVA y categoría de monotributo.</li>
        <li><strong>Tus comprobantes y tus clientes</strong>: lo que cargás para facturar (conceptos, importes, fechas y los datos de tus clientes) y la respuesta de ARCA (CAE, vencimiento, código QR).</li>
        <li><strong>Tus pedidos</strong> de arrepentimiento o de baja y los mensajes que nos mandes.</li>
      </ul>
      <h3>Los que se generan al usar Facti</h3>
      <ul>
        <li>Datos técnicos: dirección IP, tipo de navegador, fecha y hora de los pedidos y errores, para que el servicio funcione y sea seguro.</li>
      </ul>
      <p className="destacado">
        <strong>No guardamos tu clave fiscal</strong> (nunca te la pedimos) <strong>ni los datos de tu tarjeta</strong> (los procesa el
        proveedor de pagos).
      </p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y mantener tu cuenta.</li>
        <li>Emitir tus comprobantes ante ARCA y guardarlos, con sus PDF, para que los puedas consultar.</li>
        <li>Mostrarte tu facturación, tus cobros y el panel de monotributo.</li>
        <li>Mandarte avisos del servicio (por ejemplo, un cambio en estos textos o un problema con una factura). Si tenés el plan Pro, los recordatorios de cobro que actives.</li>
        <li>Atender tus consultas, reclamos y pedidos de arrepentimiento o baja.</li>
        <li>Prevenir fraudes y cumplir obligaciones legales.</li>
      </ul>
      <p>No vendemos ni alquilamos tus datos, y no los usamos para publicidad de terceros.</p>

      <h2>4. Qué datos son obligatorios</h2>
      <p>
        Para usar Facti necesitamos tu email, tu nombre y tu CUIT: sin ellos no podemos crear la cuenta ni facturar en ARCA. Si los datos
        son incorrectos, ARCA puede rechazar tus comprobantes o pueden salir con errores. El resto de los datos es optativo.
      </p>

      <h2>5. Los datos de tus clientes</h2>
      <p>
        Cuando cargás los datos de un cliente para facturarle, vos sos el responsable de esos datos y Facti los trata por tu cuenta, solo
        para emitir y guardar tus comprobantes. Cargá solo lo necesario para facturar.
      </p>

      <h2>6. Con quién los compartimos</h2>
      <ul>
        <li><strong>ARCA</strong>: los datos de cada comprobante, para que lo autorice, y tu CUIT o el de tus clientes, para consultar el padrón.</li>
        <li><strong>Proveedores que nos prestan servicios</strong>, solo para que Facti funcione: servidores y base de datos (Vercel y Supabase), autenticación (Supabase), envío de emails y cobro del plan Pro. Tienen prohibido usarlos para otra cosa.</li>
        <li>Autoridades, cuando una ley o una orden judicial lo exija.</li>
      </ul>
      <p>
        Algunos de estos proveedores guardan los datos en servidores fuera de Argentina (por ejemplo, en Brasil o en Estados Unidos). En
        esos casos exigimos medidas de seguridad y confidencialidad equivalentes a las de la Ley 25.326. Al aceptar esta Política, prestás
        tu consentimiento para esa transferencia.
      </p>

      <h2>7. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Los datos de tu cuenta, mientras la tengas activa.</li>
        <li>Los comprobantes autorizados por ARCA, sus PDF y la respuesta de ARCA, durante 10 años, para que los tengas como respaldo y por las obligaciones legales de conservación.</li>
        <li>Los registros técnicos, por un plazo corto (en general, menos de un año).</li>
      </ul>
      <p>Si das de baja tu cuenta, borramos o anonimizamos el resto de los datos, salvo los que la ley nos obligue a conservar.</p>

      <h2>8. Cómo los cuidamos</h2>
      <p>
        Usamos conexiones cifradas (HTTPS), acceso restringido a la base de datos, contraseñas cifradas y certificados y claves guardados
        fuera del código. Ningún sistema es infalible: si hubiera un incidente que afecte tus datos, te avisamos.
      </p>

      <h2>9. Tus derechos</h2>
      <p>
        Podés pedir <strong>acceder</strong> a tus datos, <strong>corregirlos</strong>, <strong>actualizarlos</strong> o{' '}
        <strong>borrarlos</strong>, y retirar tu consentimiento, escribiendo a {LEGAL.email} desde el email de tu cuenta. Respondemos los
        pedidos de acceso dentro de los 10 días corridos y los de corrección o supresión dentro de los 5 días hábiles (Ley 25.326, arts.
        14 y 16). Algunos datos no se pueden borrar mientras la ley nos obligue a conservarlos (por ejemplo, tus comprobantes).
      </p>
      <p className="destacado">
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no
        inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de
        la Ley Nº 25.326.
      </p>
      <p className="destacado">
        La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de
        atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas
        vigentes en materia de protección de datos personales. Más información en{' '}
        <a href={LEGAL.aaip} target="_blank" rel="noopener noreferrer">argentina.gob.ar/aaip</a>.
      </p>

      <h2>10. Cookies y almacenamiento en tu navegador</h2>
      <p>
        Usamos el almacenamiento de tu navegador solo para mantener tu sesión iniciada y recordar algunas preferencias. No usamos cookies
        de publicidad ni de seguimiento de terceros.
      </p>

      <h2>11. Menores de edad</h2>
      <p>Facti es para mayores de 18 años. No recolectamos a sabiendas datos de menores.</p>

      <h2>12. Cambios en esta Política</h2>
      <p>
        Si la cambiamos, te avisamos por email y en la app antes de que rija. La versión vigente está siempre en esta página, con su fecha.
        Para todo lo demás, rigen los <Link href="/legal/terminos">Términos y Condiciones</Link>.
      </p>
    </PaginaLegal>
  );
}
