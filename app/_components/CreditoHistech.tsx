import Link from "next/link";

const URL_HISTECH = "https://histech.com.co/";

/**
 * Pie de todas las páginas (se monta una sola vez en app/layout.tsx): crédito
 * del desarrollador, alcance de la licencia y enlaces a los textos legales
 * (app/(legal)). "Histech" enlaza a su página oficial en una pestaña nueva,
 * para no sacar al usuario de una inspección a medio llenar.
 */
export function CreditoHistech() {
  return (
    <footer className="bg-page px-4 py-3 text-center text-xs text-ink-muted">
      <p>
        Aplicación creada por{" "}
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
        · Uso exclusivo de ESS LTDA
      </p>
      <p className="mt-1">
        <Link href="/terminos" className="underline underline-offset-2 hover:text-ink">
          Términos y licencia
        </Link>
        {" · "}
        <Link href="/privacidad" className="underline underline-offset-2 hover:text-ink">
          Tratamiento de datos
        </Link>
      </p>
    </footer>
  );
}
