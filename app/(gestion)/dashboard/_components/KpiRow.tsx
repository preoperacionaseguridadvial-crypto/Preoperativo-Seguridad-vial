import type { KpisConComparacion } from "@/lib/inspections/reportes-queries";

/**
 * Fila de tarjetas KPI del dashboard ejecutivo. "Tasa de aprobación" es la
 * métrica de cumplimiento de esta v1 (aprobadas / total) — el sistema no
 * tiene horario de trabajador, así que no hay "a tiempo"/"fuera de
 * horario" acá (ver comentario de cabecera en
 * lib/inspections/reportes-queries.ts).
 */
export function KpiRow({ kpis }: { kpis: KpisConComparacion }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiTile
        label="Inspecciones"
        value={kpis.total}
        delta={<Delta actual={kpis.total} anterior={kpis.anterior.total} />}
      />
      <KpiTile
        label="Tasa de aprobación"
        value={`${kpis.tasaAprobacion}%`}
        delta={<Delta actual={kpis.tasaAprobacion} anterior={kpis.anterior.tasaAprobacion} />}
      />
      <KpiTile
        label="Aprobadas"
        value={kpis.aprobadas}
        delta={<Delta actual={kpis.aprobadas} anterior={kpis.anterior.aprobadas} />}
      />
      <KpiTile
        label="Rechazadas"
        value={kpis.rechazadas}
        delta={<Delta actual={kpis.rechazadas} anterior={kpis.anterior.rechazadas} invertido />}
      />
      <KpiTile
        label="Con novedades"
        value={kpis.conNovedades}
        delta={<Delta actual={kpis.conNovedades} anterior={kpis.anterior.conNovedades} invertido />}
      />
      <KpiTile label="Pendientes de aprobación" value={kpis.pendientesAprobacion} />
    </section>
  );
}

function KpiTile({ label, value, delta }: { label: string; value: string | number; delta?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white px-4 py-3">
      <span className="text-2xl font-semibold text-[#0B3B60]">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
      {delta}
    </div>
  );
}

/**
 * `invertido`: para tarjetas donde un valor más alto es peor (Rechazadas,
 * Con novedades) — el color de la variación se invierte, pero la flecha
 * siempre refleja la dirección real del número.
 */
function Delta({ actual, anterior, invertido = false }: { actual: number; anterior: number; invertido?: boolean }) {
  if (anterior === 0 && actual === 0) {
    return null;
  }
  const variacion = anterior === 0 ? 100 : Math.round(((actual - anterior) / anterior) * 1000) / 10;
  const subio = variacion > 0;
  const mejora = invertido ? !subio : subio;
  const color = variacion === 0 ? "text-gray-400" : mejora ? "text-green-700" : "text-red-700";
  const flecha = variacion === 0 ? "→" : subio ? "↑" : "↓";

  return (
    <span className={`text-xs font-medium ${color}`}>
      {flecha} {Math.abs(variacion)}% vs período anterior
    </span>
  );
}
