import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal } from '@/components/legal/PaginaLegal';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Términos y Condiciones · Facti',
  description: 'Las reglas para usar Facti, la herramienta para facturar en ARCA.',
};

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos y Condiciones" bajada="Las reglas para usar Facti, explicadas lo más claro posible.">
      <h2>1. Quiénes somos</h2>
      <p>
        Facti es un servicio de <strong>{LEGAL.titular}</strong>, persona humana, CUIT {LEGAL.cuit}, con domicilio en {LEGAL.domicilio} (en
        adelante, &quot;Facti&quot;, &quot;nosotros&quot;). Para cualquier consulta escribinos a {LEGAL.email}.
      </p>
      <p>
        Al crear tu cuenta o usar Facti aceptás estos Términos y la <Link href="/legal/privacidad">Política de Privacidad</Link>. Si no
        estás de acuerdo, no uses el servicio.
      </p>

      <h2>2. Qué es Facti (y qué no es)</h2>
      <p>
        Facti es una <strong>herramienta complementaria y de ayuda</strong> para emitir comprobantes electrónicos ante ARCA (ex AFIP) y
        ordenar tu facturación, tus cobros y tu monotributo desde un solo lugar.
      </p>
      <ul>
        <li><strong>Facti no es ARCA</strong> ni un organismo oficial, y no tiene relación con el Estado.</li>
        <li><strong>Facti no reemplaza a un contador</strong> ni da asesoramiento impositivo, contable o legal. La información que te mostramos (por ejemplo, el tipo de factura sugerido o los topes de monotributo) es orientativa.</li>
        <li>Por ahora Facti es solo para <strong>personas humanas</strong>: monotributo, responsable inscripto o exento. Todavía no está disponible para sociedades ni asociaciones.</li>
      </ul>

      <h2>3. Quién puede usar Facti</h2>
      <ul>
        <li>Personas mayores de 18 años con capacidad para contratar.</li>
        <li>Que tengan CUIT propio y lo usen para facturar su propia actividad.</li>
        <li>Una cuenta por persona. Los datos que cargues tienen que ser verdaderos y estar actualizados.</li>
      </ul>

      <h2>4. Tu cuenta y tu clave fiscal</h2>
      <p>
        Cuidá tu email y tu contraseña de Facti: lo que se haga desde tu cuenta se considera hecho por vos. Si sospechás que alguien entró
        a tu cuenta, cambiá la contraseña y avisanos.
      </p>
      <p className="destacado">
        <strong>Facti nunca te va a pedir tu clave fiscal.</strong> Para facturar, vos autorizás a Facti desde la web de ARCA, en el
        &quot;Administrador de Relaciones de Clave Fiscal&quot;, con el servicio de facturación electrónica a nombre del CUIT de Facti.
        Podés quitar esa autorización cuando quieras desde ARCA; si lo hacés, Facti deja de poder emitir por vos.
      </p>

      <h2>5. Cómo funciona la emisión de comprobantes</h2>
      <ul>
        <li>Vos cargás los datos del comprobante (cliente, conceptos, importes, fechas). Facti los envía a ARCA y ARCA, si están bien, lo autoriza y le asigna un CAE.</li>
        <li><strong>Los comprobantes son tuyos y los emitís vos</strong>, con tu CUIT. Sos responsable de que los datos sean correctos y de que el comprobante corresponda a una operación real.</li>
        <li>Facti sugiere el tipo de comprobante según tu condición y la de tu cliente en el padrón de ARCA. Revisalo antes de emitir: la decisión final es tuya.</li>
        <li>Un comprobante autorizado por ARCA no se puede borrar. Si hay un error, se corrige con una nota de crédito o de débito.</li>
        <li>Facti no responde por rechazos de ARCA, por datos mal cargados ni por las consecuencias fiscales de lo que emitas.</li>
      </ul>

      <h2>6. Disponibilidad del servicio</h2>
      <p>
        Hacemos lo posible para que Facti funcione siempre, pero depende de ARCA y de proveedores de internet y de servidores. Puede haber
        cortes o demoras que no controlamos. Si ARCA no responde, Facti consulta el estado del comprobante antes de reintentar, para no
        emitirlo dos veces. Ante un corte largo, podés emitir directamente desde la web de ARCA.
      </p>

      <h2>7. Panel de monotributo y avisos</h2>
      <p>
        El panel de monotributo, los topes de categoría y los avisos de recategorización se calculan con lo que facturaste desde Facti y
        con los valores vigentes publicados por ARCA. Son una ayuda: no incluyen lo que hayas facturado por fuera de Facti ni reemplazan
        la consulta con tu contador.
      </p>

      <h2>8. Planes y precios</h2>
      <ul>
        <li><strong>Gratis</strong>: hasta 10 facturas A, B o C y 1 Factura E por mes, con PDF y panel de monotributo.</li>
        <li><strong>Pro</strong> (pago): facturas ilimitadas, registro y recordatorios de cobro. El precio final, con impuestos incluidos, se muestra antes de contratar. Se cobra por mes y se renueva solo hasta que lo des de baja.</li>
        <li>Si cambiamos el precio del plan Pro, te avisamos por email con al menos 30 días de anticipación. Si no estás de acuerdo, podés darte de baja sin costo antes de que rija el nuevo precio.</li>
        <li>Los pagos los procesa un proveedor de pagos externo. Facti no guarda los datos de tu tarjeta.</li>
      </ul>

      <h2>9. Derecho de arrepentimiento</h2>
      <p>
        Si contrataste el plan Pro, tenés <strong>10 días corridos</strong> desde la contratación para arrepentirte, sin dar explicaciones y
        sin costo (Ley 24.240, art. 34, y Código Civil y Comercial, art. 1110). Lo pedís desde el{' '}
        <Link href="/arrepentimiento">Botón de arrepentimiento</Link>, sin iniciar sesión. Te damos en el momento un código de solicitud y te
        devolvemos lo que pagaste por el mismo medio de pago.
      </p>

      <h2>10. Baja del servicio</h2>
      <p>
        Podés dar de baja tu cuenta o el plan Pro <strong>cuando quieras</strong>, desde el{' '}
        <Link href="/baja">Botón de baja de servicio</Link>, sin iniciar sesión ni hacer trámites previos (Ley 24.240, art. 10 ter, y
        Disposición 954/2025). Te damos un código de solicitud en el momento y hacemos efectiva la baja. Desde ese momento no se te cobra
        más. Para confirmar que el pedido es tuyo, podemos pedirte que respondas desde el email de tu cuenta.
      </p>
      <p>
        Antes de irte, descargá los PDF de tus comprobantes. Los comprobantes autorizados por ARCA y sus constancias se conservan durante
        el plazo que exige la ley; el resto de tus datos se trata como explica la <Link href="/legal/privacidad">Política de Privacidad</Link>.
      </p>

      <h2>11. Usos no permitidos</h2>
      <ul>
        <li>Emitir comprobantes falsos, por operaciones inexistentes o a nombre de otra persona.</li>
        <li>Usar el CUIT de otra persona sin su autorización.</li>
        <li>Intentar acceder a cuentas ajenas, a nuestros sistemas o a los de ARCA, o afectar su funcionamiento.</li>
        <li>Copiar, revender o usar Facti para fines ilegales.</li>
      </ul>
      <p>Si detectamos un uso no permitido, podemos suspender la cuenta. Te avisamos y te explicamos por qué.</p>

      <h2>12. Propiedad intelectual</h2>
      <p>
        La marca Facti, la mascota, el diseño y el software son de Facti. Los datos y comprobantes que cargás son tuyos; nos das permiso
        para usarlos solo para prestarte el servicio.
      </p>

      <h2>13. Responsabilidad</h2>
      <p>
        Respondemos por el servicio de acuerdo con la ley. Facti no es responsable por las decisiones fiscales que tomes, por los datos que
        cargues mal ni por fallas de ARCA o de terceros que no podamos controlar. Nada de lo que dicen estos Términos limita los derechos que
        te da la Ley 24.240 de Defensa del Consumidor.
      </p>

      <h2>14. Cambios en estos Términos</h2>
      <p>
        Si cambiamos estos Términos, te avisamos por email y en la app con al menos 30 días de anticipación, salvo que el cambio lo exija
        una norma. Si no estás de acuerdo, podés darte de baja sin costo. La versión vigente siempre está en esta página, con su fecha.
      </p>

      <h2>15. Atención y reclamos</h2>
      <p>
        Atiende consultas y reclamos el área de {LEGAL.atencion}, {LEGAL.horario}, por email a {LEGAL.email}. También podés hacer una
        denuncia en la <a href={LEGAL.defensaConsumidor} target="_blank" rel="noopener noreferrer">Ventanilla Federal Única de Defensa del Consumidor</a>.
      </p>

      <h2>16. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de la República Argentina. Si sos consumidor, podés iniciar un reclamo ante los tribunales de
        tu domicilio (Ley 24.240, art. 36).
      </p>
    </PaginaLegal>
  );
}
