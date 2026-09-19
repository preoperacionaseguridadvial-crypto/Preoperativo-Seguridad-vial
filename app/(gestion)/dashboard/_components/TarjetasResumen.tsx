import type { KpisConComparacion } from "@/lib/inspections/reportes-queries";
import { formatoPorcentaje, porcentaje } from "./metricas";
import { Tarjeta } from "./Tarjeta";
import { VariacionDelta } from "./VariacionDelta";

/**
 * "Tasa de aprobación general" = aprobadas / total del período. Es la métrica
 * de cumplimiento de esta versión: el sistema no tiene horario de trabajador,
 * así que no hay "a tiempo"/"fuera de horario" (ver cabecera de
 * lib/inspections/reportes-queries.ts).
 */
export function TarjetaTasaAprobacion({ kpis }: { kpis: KpisConComparacion }) {
  const tasa = kpis.tasaAprobacion;

  return (
    <Tarjeta titulo="Tasa de aprobación general">
      <p className="text-4xl font-semibold text-ink">{formatoPorcentaje(tasa)}</p>
      <div
        role="meter"
        aria-label="Tasa de aprobación general"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={tasa}
        aria-valuetext={formatoPorcentaje(tasa)}
        className="h-2.5 w-full overflow-hidden rounded-full bg-status-ok-soft"
      >
        <div className="h-full rounded-full bg-status-ok" style={{ width: `${tasa}%` }} />
      </div>
      <VariacionDelta actual={tasa} anterior={kpis.anterior.tasaAprobacion} />
    </Tarjeta>
  );
}

/** Inspecciones que registraron al menos una novedad. Más es peor, por eso la variación va invertida. */
export function TarjetaConNovedades({ kpis }: { kpis: KpisConComparacion }) {
  return (
    <Tarjeta titulo="Con novedades">
      <p className="text-4xl font-semibold text-ink">{kpis.conNovedades}</p>
      <p className="text-xs text-ink-muted">
        {formatoPorcentaje(porcentaje(kpis.conNovedades, kpis.total))} del total de inspecciones
      </p>
      <VariacionDelta actual={kpis.conNovedades} anterior={kpis.anterior.conNovedades} invertido />
    </Tarjeta>
  );
}
