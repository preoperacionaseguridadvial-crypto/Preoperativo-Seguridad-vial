import Link from "next/link";

const URL_HISTECH = "https://histech.com.co/";

/**
 * Pie de todas las páginas (se monta una sola vez en app/layout.tsx): una sola
 * línea discreta con el crédito del desarrollador, la licencia y los textos legales
 * (app/(legal)). "Histech" enlaza a su página oficial en una pestaña nueva,
 * para no sacar al usuario de una inspección a medio llenar.
 */
export function CreditoHistech() {
  return (
    <footer className="bg-page px-4 py-2 text-center text-[11px] leading-tight text-ink-muted/80">
      <p>
        © {new Date().getFullYear()} Todos los derechos reservados{" "}
        <a
          href={URL_HISTECH}
          target="_blank"
          rel="noopener noreferrer"
          title="Ir a la página oficial de Histech"
          // #7C3AED: morado de la marca Histech (el de histech.com.co), no la
          // paleta de ESS LTDA.
          className="font-semibold text-[#7C3AED] underline-offset-2 hover:underline focus-visible:underline"
        >
          Histech
        </a>{" "}
        - ESS LTDA ·{" "}
        <Link href="/terminos" className="underline-offset-2 hover:text-ink hover:underline">
          Términos
        </Link>
        {" · "}
        <Link href="/privacidad" className="underline-offset-2 hover:text-ink hover:underline">
          Privacidad
        </Link>
      </p>
    </footer>
  );
}
