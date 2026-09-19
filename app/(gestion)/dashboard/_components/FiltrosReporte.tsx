import Link from "next/link";
import { InspectionStatus } from "@/generated/prisma/client";
import { estadoLegible, type OpcionFiltro } from "@/lib/inspections/reportes-queries";
import { buildDashboardUrl } from "./dashboard-url";
import { Icono } from "./Iconos";

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangoUltimosDias(dias: number) {
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  return { fechaDesde: formatISO(desde), fechaHasta: formatISO(hoy) };
}

function rangoEsteMes() {
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  return { fechaDesde: formatISO(desde), fechaHasta: formatISO(hoy) };
}

function rangoMesAnterior() {
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 0)); // día 0 = último día del mes anterior
  return { fechaDesde: formatISO(desde), fechaHasta: formatISO(hasta) };
}

const CLASE_CONTROL = "w-full bg-transparent text-sm text-ink focus:outline-none";

/**
 * Barra de filtros del dashboard ejecutivo. Todo GET puro, sin JS de
 * cliente: los períodos rápidos son links que arman fechaDesde/fechaHasta
 * preservando el resto de los filtros activos (`buildDashboardUrl`); los
 * campos van en un único `<form method="GET">` que, al enviarse, resetea
 * página/orden/vista a su default (es lo esperable: cambiar el filtro cambia
 * el conjunto de datos completo). Todos los campos están siempre visibles
 * (antes iban dentro de un `<details>` colapsado). El filtro de placa solo
 * afecta la tabla de detalle y las inspecciones recientes, no los KPIs ni
 * los gráficos.
 */
export function FiltrosReporte({
  searchParams,
  trabajadores,
  supervisores,
}: {
  searchParams: Record<string, string | undefined>;
  trabajadores: OpcionFiltro[];
  supervisores: OpcionFiltro[];
}) {
  const periodos = [
    { label: "Hoy", rango: rangoUltimosDias(1) },
    { label: "Últimos 7 días", rango: rangoUltimosDias(7) },
    { label: "Últimos 30 días", rango: rangoUltimosDias(30) },
    { label: "Este mes", rango: rangoEsteMes() },
    { label: "Mes anterior", rango: rangoMesAnterior() },
  ];

  return (
    <form method="GET" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div role="group" aria-label="Período rápido" className="flex flex-wrap gap-2">
        {periodos.map((p) => {
          const activo = searchParams.fechaDesde === p.rango.fechaDesde && searchParams.fechaHasta === p.rango.fechaHasta;
          return (
            <Link
              key={p.label}
              href={buildDashboardUrl("/dashboard", searchParams, { ...p.rango, page: undefined })}
              aria-current={activo ? "true" : undefined}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                activo ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink hover:bg-page"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <Campo label="Desde">
        <input type="date" name="fechaDesde" defaultValue={searchParams.fechaDesde ?? ""} className={CLASE_CONTROL} />
      </Campo>
      <Campo label="Hasta">
        <input type="date" name="fechaHasta" defaultValue={searchParams.fechaHasta ?? ""} className={CLASE_CONTROL} />
      </Campo>
      <Campo label="Trabajador">
        <select name="trabajador" defaultValue={searchParams.trabajador ?? ""} className={CLASE_CONTROL}>
          <option value="">Todos</option>
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Supervisor">
        <select name="supervisor" defaultValue={searchParams.supervisor ?? ""} className={CLASE_CONTROL}>
          <option value="">Todos</option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Placa">
        <input type="text" name="placa" defaultValue={searchParams.placa ?? ""} placeholder="Todas" className={CLASE_CONTROL} />
      </Campo>
      <Campo label="Estado">
        <select name="estado" defaultValue={searchParams.estado ?? ""} className={CLASE_CONTROL}>
          <option value="">Todos</option>
          {Object.values(InspectionStatus).map((e) => (
            <option key={e} value={e}>
              {estadoLegible(e)}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Resultado">
        <select name="resultado" defaultValue={searchParams.resultado ?? ""} className={CLASE_CONTROL}>
          <option value="">Todos</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </Campo>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          <Icono nombre="buscar" className="size-4" />
          Buscar
        </button>
        <Link href="/dashboard" className="text-sm font-medium text-status-info-ink hover:underline">
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}

/** Campo con la etiqueta pequeña arriba del valor, dentro de una caja (como el panel de referencia). El `<label>` envuelve al control. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-[8.5rem] flex-1 flex-col rounded-lg border border-border bg-surface px-3 py-1 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
      <span className="text-[11px] text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
