import type { Metadata } from "next";
import { DocumentoLegal, Lista, Seccion } from "@/app/(legal)/_components/DocumentoLegal";

export const metadata: Metadata = { title: "Términos y licencia de uso" };

const ENLACE = "font-semibold text-[#7C3AED] underline-offset-2 hover:underline";

// Texto de referencia: debe coincidir con el contrato de licencia firmado
// entre Histech y ESS LTDA y ser validado por un abogado antes de publicarse.
export default function TerminosPage() {
  return (
    <DocumentoLegal titulo="Términos y licencia de uso" version="Versión 1.0 · octubre de 2026">
      <Seccion titulo="1. Titularidad del software">
        <p>
          Esta aplicación, incluidos su código fuente, su diseño, su estructura, su documentación y
          sus actualizaciones, es una obra desarrollada por Histech, que es su autor y el titular de
          los derechos de propiedad intelectual sobre ella, protegidos por las normas colombianas e
          internacionales de derecho de autor.
        </p>
      </Seccion>

      <Seccion titulo="2. Licencia otorgada a ESS LTDA">
        <p>
          ESS LTDA cuenta con una licencia de uso de la aplicación para la gestión de sus
          inspecciones preoperacionales de seguridad vial. Esta licencia es de uso exclusivo de ESS
          LTDA y de su personal autorizado, y no implica la cesión de la propiedad del software ni
          de su código fuente.
        </p>
        <p>La licencia no permite:</p>
        <Lista>
          <li>ceder, revender, arrendar o sublicenciar la aplicación a terceros;</li>
          <li>copiarla, modificarla o crear obras derivadas sin autorización escrita de Histech;</li>
          <li>descompilarla, aplicarle ingeniería inversa o intentar obtener su código fuente;</li>
          <li>retirar u ocultar los avisos de autoría y de licencia.</li>
        </Lista>
      </Seccion>

      <Seccion titulo="3. Uso por parte de otras empresas">
        <p>
          La aplicación no es de libre uso. Cualquier persona u organización distinta de ESS LTDA
          que quiera utilizarla debe contactar a Histech para adquirir su propia licencia y la
          activación del producto, a través de{" "}
          <a href="https://histech.com.co/" target="_blank" rel="noopener noreferrer" className={ENLACE}>
            histech.com.co
          </a>
          . El uso sin licencia constituye una infracción a los derechos de autor.
        </p>
      </Seccion>

      <Seccion titulo="4. Uso autorizado de las cuentas">
        <Lista>
          <li>Las cuentas son personales e intransferibles; cada usuario responde por la suya.</li>
          <li>El acceso está reservado al personal que ESS LTDA autorice.</li>
          <li>
            La información registrada debe ser veraz: las inspecciones y declaraciones tienen efectos
            en la seguridad vial y quedan firmadas por quien las diligencia.
          </li>
          <li>No se debe intentar acceder a información de otros usuarios ni vulnerar la seguridad.</li>
        </Lista>
      </Seccion>

      <Seccion titulo="5. Datos personales">
        <p>
          El tratamiento de los datos personales registrados en la aplicación se rige por la política
          de tratamiento de datos, disponible en el pie de todas las páginas.
        </p>
      </Seccion>

      <Seccion titulo="6. Cambios">
        <p>
          Estos términos pueden actualizarse. La versión vigente es la publicada en esta página.
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
