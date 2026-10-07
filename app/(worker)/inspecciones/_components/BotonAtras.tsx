import Link from "next/link";

/**
 * Botón "← Atrás" de cada paso de una inspección EN_PROCESO (arriba a la
 * izquierda, objetivo táctil grande). Solo navega: no escribe nada, así que
 * volver a un paso ya respondido nunca altera datos; el servidor sigue siendo
 * la única fuente de verdad de qué se puede modificar (las mutaciones exigen
 * EN_PROCESO, ver `getOwnInspeccionEnProceso`). Cada página calcula `href` con
 * `getPreviousStepPath` (lib/inspections/queries.ts) o lo fija cuando es una
 * subpantalla (novedad, foto de novedad, justificación).
 */
export function BotonAtras({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-12 w-fit items-center rounded-md px-3 text-base font-semibold text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span aria-hidden="true">←</span>&nbsp;Atrás
    </Link>
  );
}
