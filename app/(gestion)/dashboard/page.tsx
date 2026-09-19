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
import { BannerAlertas } from "./_components/BannerAlertas";
import { TarjetasAnillo } from "./_components/TarjetasAnillo";
import { AccionesRapidas } from "./_components/AccionesRapidas";
import { TendenciaChart } from "./_components/TendenciaChart";
import { EstadoBarra } from "./_components/EstadoBarra";
import { HeatmapCumplimiento } from "./_components/HeatmapCumplimiento";
import { TarjetaConNovedades, TarjetaTasaAprobacion } from "./_components/TarjetasResumen";
import { VehiculosMasNovedades } from "./_components/VehiculosMasNovedades";
import { FallasPorItem } from "./_components/FallasPorItem";
import { NovedadesPorTipo } from "./_components/NovedadesPorTipo";
import { InspeccionesRecientes } from "./_components/InspeccionesRecientes";
import { TablaTrabajadores } from "./_components/TablaTrabajadores";
import { TablaVehiculos } from "./_components/TablaVehiculos";
import { Top5 } from "./_components/Top5";
import { TablaDetalle } from "./_components/TablaDetalle";
import { Icono } from "./_components/Iconos";
import { puedeExportarExcel } from "./_components/acciones-rapidas";
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

const CLASE_BOTON_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-status-info-ink shadow-sm hover:bg-page";

/**
 * "Dashboard Operacional" — dashboard ejecutivo de DIRECTOR/SST (también lo
 * abre ADMINISTRADOR, ver proxy.ts). Reemplaza al dashboard operativo
 * anterior (KPIs planos + 2 rankings). Todos los filtros viajan por query
 * string y afectan TODAS las secciones porque todas se calculan a partir del
 * mismo `filtrosReporte` derivado acá, en un único `Promise.all` (salvo
 * `placa`, que solo acota la lista de inspecciones: recientes y detalle).
 * Orden: resumen (alertas, KPIs, estado, tendencia, cumplimiento diario,
 * rankings), inspecciones recientes y, al final, el detalle.
 *
 * El sistema no tiene ningún concepto de horario/programación de
 * trabajador — no hay "inspecciones esperadas", "a tiempo" ni "fuera de
 * horario" en ningún lado de este dashboard, ni "tiempo promedio de
 * aprobación" (no se mide). "Cumplimiento" acá significa tasa de aprobación
 * (aprobadas / total del período). Ver cabecera de
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

  const role = session.user.role;
  const urlExcel = buildDashboardUrl("/api/reportes/excel", sp, {});
  const ahora = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard Operacional</h1>
          <p className="text-sm text-ink-muted">Indicadores de cumplimiento de inspecciones preoperacionales</p>
          <p className="mt-0.5 text-xs text-ink-muted">Última actualización: {ahora}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={buildDashboardUrl("/dashboard", sp, {})} className={CLASE_BOTON_SECUNDARIO}>
            <Icono nombre="actualizar" />
            Actualizar
          </Link>
          <Link href="/consulta-inspecciones" className={CLASE_BOTON_SECUNDARIO}>
            <Icono nombre="buscar" />
            Buscar inspecciones
          </Link>
          {puedeExportarExcel(role) && (
            <a
              href={urlExcel}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand/90"
            >
              <Icono nombre="descarga" />
              Exportar Excel
            </a>
          )}
        </div>
      </div>

      <FiltrosReporte searchParams={sp} trabajadores={trabajadoresOpciones} supervisores={supervisoresOpciones} />

      <BannerAlertas kpis={kpis} vehiculos={filasVehiculo} topFalla={fallasPorItem[0]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <TarjetasAnillo kpis={kpis} />
        <AccionesRapidas role={role} urlExcel={urlExcel} className="sm:col-span-2 xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <EstadoBarra
          total={kpis.total}
          aprobadas={kpis.aprobadas}
          rechazadas={kpis.rechazadas}
          pendientes={kpis.pendientesAprobacion}
        />
        <TendenciaChart
          datos={tendencia}
          vista={vista}
          searchParams={sp}
          className="lg:order-3 lg:col-span-2 xl:order-none xl:col-span-1"
        />
        <HeatmapCumplimiento datos={tendencia} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
        <TarjetaTasaAprobacion kpis={kpis} />
        <TarjetaConNovedades kpis={kpis} />
        <VehiculosMasNovedades filas={filasVehiculo} />
        <FallasPorItem datos={fallasPorItem} />
        <NovedadesPorTipo datos={novedadesPorTipo} />
      </div>

      <InspeccionesRecientes inspecciones={inspeccionesDetalle} role={role} />

      <h2 className="mt-2 text-lg font-semibold text-ink">Detalle</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TablaTrabajadores filas={filasTrabajador} sort={sortTrabajador} dir={dirTrabajador} q={qTrabajador} searchParams={sp} />
        <TablaVehiculos filas={filasVehiculo} sort={sortVehiculo} dir={dirVehiculo} searchParams={sp} />
      </div>

      <Top5 filasTrabajador={filasTrabajadorSinFiltrar} />

      <TablaDetalle inspecciones={inspeccionesDetalle} page={page} searchParams={sp} role={role} />
    </main>
  );
}
