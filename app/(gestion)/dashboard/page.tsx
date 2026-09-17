import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import {
  getCumplimientoPorTrabajador,
  getEstadoPorVehiculo,
  getFallasPorItem,
  getKpisReporte,
  getNovedadesPorTipo,
  getSupervisoresParaFiltro,
  getTendenciaDiaria,
  getTrabajadoresParaFiltro,
  parseFiltrosDesdeQuery,
  type SortTrabajador,
  type SortVehiculo,
} from "@/lib/inspections/reportes-queries";
import { FiltrosReporte } from "./_components/FiltrosReporte";
import { KpiRow } from "./_components/KpiRow";
import { TendenciaChart } from "./_components/TendenciaChart";
import { EstadoBarra } from "./_components/EstadoBarra";
import { TablaTrabajadores } from "./_components/TablaTrabajadores";
import { TablaVehiculos } from "./_components/TablaVehiculos";
import { NovedadesPorTipo } from "./_components/NovedadesPorTipo";
import { FallasPorItem } from "./_components/FallasPorItem";
import { HeatmapCumplimiento } from "./_components/HeatmapCumplimiento";
import { AlertasEjecutivas } from "./_components/AlertasEjecutivas";
import { Top5 } from "./_components/Top5";
import { TablaDetalle } from "./_components/TablaDetalle";
import { buildDashboardUrl } from "./_components/dashboard-url";

type SearchParams = {
  fechaDesde?: string;
  fechaHasta?: string;
  trabajador?: string;
  placa?: string;
  estado?: string;
  resultado?: string;
  supervisor?: string;
  vista?: string;
  sortTrabajador?: string;
  dirTrabajador?: string;
  sortVehiculo?: string;
  dirVehiculo?: string;
  qTrabajador?: string;
  page?: string;
};

const SORT_TRABAJADOR_VALIDOS: SortTrabajador[] = ["nombre", "total", "aprobadas", "rechazadas", "novedades", "tasaAprobacion"];
const SORT_VEHICULO_VALIDOS: SortVehiculo[] = ["placa", "total", "aprobadas", "rechazadas", "novedades", "ultimaInspeccion"];

/**
 * "Informes de Gerencia" — dashboard ejecutivo de DIRECTOR/SST. Reemplaza al
 * dashboard operativo anterior (KPIs planos + 2 rankings). Todos los
 * filtros viajan por query string y afectan TODAS las secciones porque
 * todas se calculan a partir del mismo `filtrosReporte` derivado acá, en un
 * único `Promise.all`.
 *
 * El sistema no tiene ningún concepto de horario/programación de
 * trabajador — no hay "inspecciones esperadas", "a tiempo" ni "fuera de
 * horario" en ningún lado de este dashboard. "Cumplimiento" acá significa
 * tasa de aprobación (aprobadas / total del período). Ver cabecera de
 * lib/inspections/reportes-queries.ts.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const filtrosReporte = parseFiltrosDesdeQuery(sp);

  const vista: "cantidad" | "tasa" = sp.vista === "tasa" ? "tasa" : "cantidad";
  const sortTrabajador: SortTrabajador = SORT_TRABAJADOR_VALIDOS.includes(sp.sortTrabajador as SortTrabajador)
    ? (sp.sortTrabajador as SortTrabajador)
    : "tasaAprobacion";
  const dirTrabajador: "asc" | "desc" = sp.dirTrabajador === "desc" ? "desc" : "asc";
  const sortVehiculo: SortVehiculo = SORT_VEHICULO_VALIDOS.includes(sp.sortVehiculo as SortVehiculo)
    ? (sp.sortVehiculo as SortVehiculo)
    : "novedades";
  const dirVehiculo: "asc" | "desc" = sp.dirVehiculo === "asc" ? "asc" : "desc";
  const qTrabajador = (sp.qTrabajador ?? "").trim();
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;

  const [
    kpis,
    tendencia,
    filasTrabajadorSinFiltrar,
    filasVehiculo,
    novedadesPorTipo,
    fallasPorItem,
    trabajadoresOpciones,
    supervisoresOpciones,
    inspeccionesDetalle,
  ] = await Promise.all([
    getKpisReporte(filtrosReporte),
    getTendenciaDiaria(filtrosReporte),
    getCumplimientoPorTrabajador(filtrosReporte, sortTrabajador, dirTrabajador),
    getEstadoPorVehiculo(filtrosReporte, sortVehiculo, dirVehiculo),
    getNovedadesPorTipo(filtrosReporte),
    getFallasPorItem(filtrosReporte),
    getTrabajadoresParaFiltro(),
    getSupervisoresParaFiltro(),
    getAllInspeccionesForOversight({
      placa: sp.placa || undefined,
      estado: filtrosReporte.status,
      fechaDesde: filtrosReporte.fechaDesde,
      fechaHasta: filtrosReporte.fechaHasta,
      workerId: filtrosReporte.workerId,
      supervisorId: filtrosReporte.supervisorId,
      puedeOperar: filtrosReporte.puedeOperar,
    }),
  ]);

  const filasTrabajador = qTrabajador
    ? filasTrabajadorSinFiltrar.filter((f) => f.nombre.toLowerCase().includes(qTrabajador.toLowerCase()))
    : filasTrabajadorSinFiltrar;

  const vehiculosConMultiplesNovedades = filasVehiculo.filter((v) => v.novedades >= 2);

  const ahora = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B3B60]">Informes de Gerencia</h1>
          <p className="text-sm text-gray-500">Indicadores de cumplimiento de inspecciones preoperacionales</p>
          <p className="mt-1 text-xs text-gray-400">Última actualización: {ahora}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildDashboardUrl("/dashboard", sp, {})}
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Actualizar
          </Link>
          <Link
            href="/consulta-inspecciones"
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Buscar inspecciones →
          </Link>
          <a
            href={buildDashboardUrl("/api/reportes/excel", sp, {})}
            className="rounded-md bg-[#0B3B60] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
          >
            Exportar Excel
          </a>
        </div>
      </div>

      <FiltrosReporte searchParams={sp} trabajadores={trabajadoresOpciones} supervisores={supervisoresOpciones} />

      <KpiRow kpis={kpis} />

      <TendenciaChart datos={tendencia} vista={vista} searchParams={sp} />

      <EstadoBarra aprobadas={kpis.aprobadas} rechazadas={kpis.rechazadas} pendientes={kpis.pendientesAprobacion} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TablaTrabajadores filas={filasTrabajador} sort={sortTrabajador} dir={dirTrabajador} q={qTrabajador} searchParams={sp} />
        <TablaVehiculos filas={filasVehiculo} sort={sortVehiculo} dir={dirVehiculo} searchParams={sp} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NovedadesPorTipo datos={novedadesPorTipo} />
        <FallasPorItem datos={fallasPorItem} />
      </div>

      <HeatmapCumplimiento datos={tendencia} />

      <AlertasEjecutivas kpis={kpis} vehiculosConMultiplesNovedades={vehiculosConMultiplesNovedades} topFalla={fallasPorItem[0]} />

      <Top5 filasTrabajador={filasTrabajadorSinFiltrar} filasVehiculo={filasVehiculo} fallasPorItem={fallasPorItem} />

      <TablaDetalle inspecciones={inspeccionesDetalle} page={page} searchParams={sp} />
    </main>
  );
}
