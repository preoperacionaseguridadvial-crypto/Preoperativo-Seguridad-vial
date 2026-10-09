import type { Metadata } from "next";
import { DocumentoLegal, Lista, Seccion } from "@/app/(legal)/_components/DocumentoLegal";

export const metadata: Metadata = { title: "Política de tratamiento de datos personales" };

// Texto de referencia basado en la Ley 1581 de 2012 y el Decreto 1377 de 2013:
// debe ser validado por un abogado y completado con los datos de contacto del
// responsable (NIT, domicilio, correo y teléfono de ESS LTDA) antes de
// publicarse. Los datos listados en la sección 2 salen de prisma/schema.prisma;
// si se agrega un dato personal nuevo, actualizarlo acá.
export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      titulo="Política de tratamiento de datos personales"
      version="Versión 1.0 · octubre de 2026"
    >
      <Seccion titulo="1. Responsable y encargado">
        <p>
          Esta política se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 y las demás normas
          colombianas sobre protección de datos personales.
        </p>
        <Lista>
          <li>
            <strong>Responsable del tratamiento:</strong> ESS LTDA, que decide para qué y cómo se
            usan los datos registrados en la aplicación.
          </li>
          <li>
            <strong>Encargado del tratamiento:</strong> Histech, que desarrolla, aloja y da soporte a
            la aplicación por cuenta de ESS LTDA y solo trata los datos siguiendo sus instrucciones.
          </li>
        </Lista>
      </Seccion>

      <Seccion titulo="2. Datos que se tratan">
        <Lista>
          <li>
            <strong>Identificación y contacto:</strong> nombre, número de cédula, correo electrónico,
            teléfono, cargo, sede y puesto asignado.
          </li>
          <li>
            <strong>Vehículo asignado:</strong> placa, marca, modelo, color, fotografía y vigencia
            del SOAT y de la revisión tecnicomecánica.
          </li>
          <li>
            <strong>Inspecciones:</strong> respuestas del preoperacional, kilometraje, novedades
            reportadas, fotografías del vehículo, fecha y hora.
          </li>
          <li>
            <strong>Firma:</strong> la firma manuscrita digitalizada de quien diligencia y de quien
            aprueba la inspección.
          </li>
          <li>
            <strong>Uso de la aplicación:</strong> registros de las acciones realizadas, con fines de
            seguridad y trazabilidad.
          </li>
        </Lista>
      </Seccion>

      <Seccion titulo="3. Datos sensibles">
        <p>
          Antes de cada inspección, el conductor declara si se encuentra en condiciones aptas para
          conducir, si consumió alcohol y si toma medicamentos que afecten la conducción. Estas
          declaraciones se refieren a la salud y son datos sensibles. Su tratamiento requiere la
          autorización explícita del titular, que debe ser informado de que se trata de datos
          sensibles, de la finalidad para la que se recogen y de que, por regla general, no está
          obligado a autorizar su tratamiento.
        </p>
        <p>
          Estos datos se usan únicamente para verificar la aptitud para conducir y prevenir
          siniestros viales, y solo los consulta el personal autorizado por ESS LTDA.
        </p>
      </Seccion>

      <Seccion titulo="4. Finalidades">
        <Lista>
          <li>Registrar y aprobar las inspecciones preoperacionales diarias de los vehículos.</li>
          <li>Cumplir las obligaciones de seguridad vial y de seguridad y salud en el trabajo.</li>
          <li>Hacer seguimiento a las novedades y al mantenimiento de los vehículos.</li>
          <li>Generar los reportes y formatos exigidos por las autoridades y por auditorías.</li>
          <li>Administrar las cuentas de usuario y la seguridad de la aplicación.</li>
        </Lista>
        <p>Los datos no se usan con fines comerciales ni se venden a terceros.</p>
      </Seccion>

      <Seccion titulo="5. Derechos del titular">
        <p>Como titular de sus datos, usted tiene derecho a:</p>
        <Lista>
          <li>conocer, actualizar y rectificar sus datos personales;</li>
          <li>solicitar prueba de la autorización otorgada;</li>
          <li>ser informado sobre el uso que se ha dado a sus datos;</li>
          <li>
            revocar la autorización o solicitar la supresión de sus datos, cuando no exista un deber
            legal o contractual de conservarlos;
          </li>
          <li>acceder de forma gratuita a los datos que hayan sido objeto de tratamiento;</li>
          <li>
            presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a las
            normas de protección de datos, una vez agotado el trámite ante ESS LTDA.
          </li>
        </Lista>
      </Seccion>

      <Seccion titulo="6. Cómo ejercer sus derechos">
        <p>
          Las consultas y los reclamos se presentan ante ESS LTDA, como responsable del tratamiento,
          a través de su área de Seguridad y Salud en el Trabajo. Las consultas se atienden en un
          máximo de diez (10) días hábiles y los reclamos en un máximo de quince (15) días hábiles,
          contados desde su recibo, en los términos de la Ley 1581 de 2012.
        </p>
      </Seccion>

      <Seccion titulo="7. Seguridad y conservación">
        <p>
          El acceso a la aplicación exige usuario y contraseña, está limitado según el rol de cada
          persona y las contraseñas no se almacenan en texto legible. Los datos se conservan durante el tiempo
          necesario para cumplir las finalidades descritas y los plazos de conservación que exigen
          las normas de seguridad vial y laborales; cumplido ese tiempo, se suprimen.
        </p>
      </Seccion>

      <Seccion titulo="8. Vigencia y cambios">
        <p>
          Esta política rige desde su publicación. Cualquier cambio sustancial se informará a los
          titulares a través de la aplicación.
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
