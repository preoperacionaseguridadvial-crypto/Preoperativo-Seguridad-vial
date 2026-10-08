import Link from "next/link";

/**
 * Botón "← Atrás" de cada paso de una inspección EN_PROCESO (arriba a la
 * izquierda, objetivo táctil grande). Solo navega: no escribe nada, así que
 * volver a un paso ya respondido nunca altera datos; el servidor sigue siendo
 * la única fuente de verdad de qué se puede modificar (las mutaciones exigen
 * EN_PROCESO, ver `getOwnInspeccionEnProceso`). Cada página calcula `href` con
 * `getPreviousStepPath` (lib/inspections/queries.ts) o lo fija cuando es una
 * subpantalla (novedad, foto de novedad, justificación).
 *
 * Se dibuja DENTRO de la barra del encabezado, al lado del logo (pedido del
 * dueño de producto: en el celular una fila propia desperdiciaba espacio):
 * posición absoluta sobre el contenedor `relative` del layout
 * (app/(worker)/inspecciones/layout.tsx), con el mismo alto que AppHeader
 * (h-12). Al salir del flujo, el contenido de la página sube.
 */
export function BotonAtras({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="absolute left-12 top-0 z-10 inline-flex h-12 items-center rounded-md px-3 text-base font-semibold text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span aria-hidden="true">←</span>&nbsp;Atrás
    </Link>
  );
}
