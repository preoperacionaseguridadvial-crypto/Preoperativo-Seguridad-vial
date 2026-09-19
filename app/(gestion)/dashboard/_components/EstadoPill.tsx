import type { TonoEstado } from "./estado";

const CLASES_POR_TONO: Record<TonoEstado, { pill: string; punto: string }> = {
  ok: { pill: "bg-status-ok-soft text-status-ok-ink", punto: "bg-status-ok" },
  falla: { pill: "bg-status-crit-soft text-status-crit-ink", punto: "bg-status-crit" },
  aviso: { pill: "bg-status-warn-soft text-status-warn-ink", punto: "bg-status-warn" },
  info: { pill: "bg-status-info-soft text-status-info-ink", punto: "bg-viz-blue" },
  neutro: { pill: "bg-status-neutral-soft text-status-neutral-ink", punto: "bg-ink-muted" },
};

/**
 * "Píldora" de estado: el texto lleva el significado (Aprobada, Rechazada…)
 * y el punto de color solo lo refuerza — nunca es el único canal.
 */
export function EstadoPill({ tono, children }: { tono: TonoEstado; children: React.ReactNode }) {
  const clases = CLASES_POR_TONO[tono];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${clases.pill}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${clases.punto}`} />
      {children}
    </span>
  );
}
