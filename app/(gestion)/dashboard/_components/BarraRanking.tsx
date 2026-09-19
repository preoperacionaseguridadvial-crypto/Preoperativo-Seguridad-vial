import { tonoSeveridad, type TonoSeveridad } from "./metricas";

/** Color de barra por tono de severidad (rojo -> naranja -> amarillo -> verde). Siempre con el número al lado. */
export const COLOR_SEVERIDAD: Record<TonoSeveridad, string> = {
  critico: "var(--color-status-crit)",
  serio: "var(--color-status-serious)",
  atencion: "var(--color-status-warn)",
  bajo: "var(--color-status-ok)",
};

/** Colorea cada barra según su proporción respecto del máximo del ranking (ver `tonoSeveridad`). */
export const colorPorSeveridad = (valor: number, maximo: number) => COLOR_SEVERIDAD[tonoSeveridad(valor, maximo)];

export type ItemRanking = {
  label: string;
  value: number;
  /** Texto secundario junto al valor (ej. "(25%)"). */
  detalle?: string;
};

// Barra horizontal rankeada, de presentación pura: sin interactividad (los
// valores van siempre visibles al lado de la barra, no dependen de hover),
// así que no hace falta "use client". Todas las filas comparten las mismas
// columnas (una sola grilla) para que las barras arranquen y terminen
// alineadas. `color` es un único color de identidad o una función que lo
// decide por barra (`colorPorSeveridad`); nunca es el único canal — el
// número y la etiqueta van siempre a la vista.
export function BarraRanking({
  data,
  color,
  emptyMessage,
  formatValue,
  maximo,
}: {
  data: ItemRanking[];
  color: string | ((valor: number, maximo: number) => string);
  emptyMessage: string;
  /** Formato del número mostrado a la derecha (ej. agregar "%") — por defecto, el valor tal cual. */
  formatValue?: (value: number) => string;
  /** Valor que representa el 100% de la barra. Por defecto, el mayor del ranking (para tasas: 100). */
  maximo?: number;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyMessage}</p>;
  }

  const max = maximo ?? Math.max(...data.map((d) => d.value));
  const mostrar = formatValue ?? ((v: number) => String(v));

  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="contents">
          <span className="truncate text-sm text-ink" title={d.label}>
            {d.label}
          </span>
          <div className="h-2.5 overflow-hidden rounded-full bg-viz-track">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? Math.max((d.value / max) * 100, 4) : 4}%`,
                backgroundColor: typeof color === "function" ? color(d.value, max) : color,
              }}
            />
          </div>
          <span className="text-right text-sm tabular-nums text-ink">
            <span className="font-semibold">{mostrar(d.value)}</span>
            {d.detalle && <span className="ml-1 text-xs text-ink-muted">{d.detalle}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
