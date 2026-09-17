import Link from "next/link";
import { InspectionStatus } from "@/generated/prisma/client";
import { estadoLegible, type OpcionFiltro } from "@/lib/inspections/reportes-queries";
import { buildDashboardUrl } from "./dashboard-url";

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

/**
 * Barra de filtros del dashboard ejecutivo. Todo GET puro, sin JS de
 * cliente: los períodos rápidos son links que arman fechaDesde/fechaHasta
 * preservando el resto de los filtros activos (`buildDashboardUrl`); el
 * resto de los filtros van en un `<form method="GET">` que, al enviarse,
 * resetea página/orden/vista a su default (es lo esperable: cambiar el
 * filtro cambia el conjunto de datos completo). El bloque de filtros
 * detallados va en un `<details>` colapsado por defecto en TODAS las
 * pantallas (no solo mobile) — sin JS no hay forma honesta de que arranque
 * abierto en desktop y cerrado en mobile a la vez.
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
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {periodos.map((p) => {
          const activo = searchParams.fechaDesde === p.rango.fechaDesde && searchParams.fechaHasta === p.rango.fechaHasta;
          return (
            <Link
              key={p.label}
              href={buildDashboardUrl("/dashboard", searchParams, { ...p.rango, page: undefined })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                activo ? "bg-[#0B3B60] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-[#2E9BD6]">Más filtros</summary>
        <form method="GET" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo label="Trabajador">
            <select name="trabajador" defaultValue={searchParams.trabajador ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none">
              <option value="">Todos</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Placa">
            <input type="text" name="placa" defaultValue={searchParams.placa ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none" />
          </Campo>
          <Campo label="Estado">
            <select name="estado" defaultValue={searchParams.estado ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none">
              <option value="">Todos</option>
              {Object.values(InspectionStatus).map((e) => (
                <option key={e} value={e}>
                  {estadoLegible(e)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Resultado">
            <select name="resultado" defaultValue={searchParams.resultado ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none">
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </Campo>
          <Campo label="Supervisor">
            <select name="supervisor" defaultValue={searchParams.supervisor ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none">
              <option value="">Todos</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Desde">
              <input type="date" name="fechaDesde" defaultValue={searchParams.fechaDesde ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none" />
            </Campo>
            <Campo label="Hasta">
              <input type="date" name="fechaHasta" defaultValue={searchParams.fechaHasta ?? ""} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none" />
            </Campo>
          </div>
          <div className="col-span-full flex items-center gap-4">
            <button type="submit" className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90">
              Buscar
            </button>
            <Link href="/dashboard" className="text-sm text-[#2E9BD6] hover:underline">
              Limpiar filtros
            </Link>
          </div>
        </form>
      </details>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
