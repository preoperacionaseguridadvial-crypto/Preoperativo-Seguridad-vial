import { formatoPorcentaje } from "./metricas";
import { segmentosEstado, type SegmentoEstado } from "./estado";
import { Tarjeta } from "./Tarjeta";

// Distribución del período en una única barra apilada horizontal (en vez de
// donut): una barra da lectura más precisa que un donut para comparar pocas
// partes. Colores de estado (verde/rojo/ámbar) + un gris neutro para "otros
// estados" (en proceso, enviadas, canceladas…), de modo que las partes
// sumen el mismo total que muestran las tarjetas. El texto dentro del
// segmento usa tinta oscura o blanca según el fondo para cumplir el contraste,
// y solo aparece si cabe (ver `segmentosEstado`); la leyenda siempre lleva
// valor y porcentaje, así el color nunca es el único canal.
const CLASES: Record<SegmentoEstado["key"], { fondo: string; texto: string; punto: string }> = {
  aprobadas: { fondo: "bg-status-ok", texto: "text-viz-ink", punto: "bg-status-ok" },
  rechazadas: { fondo: "bg-status-crit", texto: "text-white", punto: "bg-status-crit" },
  pendientes: { fondo: "bg-status-warn", texto: "text-viz-ink", punto: "bg-status-warn" },
  otros: { fondo: "bg-viz-otros", texto: "text-viz-ink", punto: "bg-viz-otros" },
};

export function EstadoBarra({
  total: totalPeriodo,
  aprobadas,
  rechazadas,
  pendientes,
  className = "",
}: {
  total: number;
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
  className?: string;
}) {
  const { total, segmentos } = segmentosEstado({ total: totalPeriodo, aprobadas, rechazadas, pendientes });

  return (
    <Tarjeta titulo="Resumen de estado de inspecciones" className={className}>
      {total === 0 ? (
        <p className="text-sm text-ink-muted">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Estado de ${total} inspecciones: ${segmentos
              .filter((s) => s.valor > 0)
              .map((s) => `${s.label} ${s.valor} (${formatoPorcentaje(s.porcentaje)})`)
              .join(", ")}`}
            className="mt-2 flex h-9 w-full gap-0.5"
          >
            {segmentos
              .filter((s) => s.valor > 0)
              .map((s) => (
                <div
                  key={s.key}
                  style={{ flex: `${s.valor} 1 0%` }}
                  title={`${s.label}: ${s.valor} (${formatoPorcentaje(s.porcentaje)})`}
                  className={`flex min-w-0 items-center justify-center text-xs font-semibold first:rounded-l-lg last:rounded-r-lg ${CLASES[s.key].fondo} ${CLASES[s.key].texto}`}
                >
                  {s.etiquetaInterna}
                </div>
              ))}
          </div>
          <p className="text-right text-xs text-ink-muted">Total: {total} inspecciones</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink">
            {segmentos.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`size-2 rounded-full ${CLASES[s.key].punto}`} />
                {s.label}
                <span className="text-ink-muted">
                  {s.valor} ({formatoPorcentaje(s.porcentaje)})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}
