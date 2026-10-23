import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { Role, Sede } from "@/generated/prisma/enums";
import { estadoEtapaOleariari } from "@/lib/inspections/cola-aprobacion";
import { formatFechaCorta, formatHora } from "@/lib/fechas/formato";
import {
  ESTADOS_FILTRO,
  contarPorEstado,
  etiquetaConteo,
  etiquetaEstado,
  parsearFiltrosConsulta,
  type ParamsConsulta,
} from "@/lib/inspections/filtros-consulta";
import { puedeAccederARuta } from "@/lib/auth/route-roles";
import { puedeDescargarPdf } from "@/lib/inspections/pdf-acceso";
import { MAX_PDFS_POR_LOTE, contarDescargables, queryStringFiltros } from "@/lib/inspections/pdf-lote";
import { tonoEstado, type TonoEstado } from "../dashboard/_components/estado";
import {
  IconoBuscar,
  IconoCalendario,
  IconoCamion,
  IconoCheck,
  IconoChevron,
  IconoDocumento,
  IconoFiltro,
  IconoPersona,
  IconoRefrescar,
  IconoReloj,
  IconoX,
} from "./_components/Iconos";

// Punto de entrada de la consulta de oversight (DIRECTOR/SST/SUPERVISOR/
// ADMINISTRADOR y Supervisor Oleariari, este último solo de su sede): lista de
// las inspecciones, cualquier estado, cualquier recorredor, con filtros
// opcionales por conductor/placa/estado/rango de fecha vía query params
// (form GET puro, sin JS). Pantalla de solo lectura — sin ninguna acción de
// mutación (ver [id]/page.tsx para el detalle, también de solo lectura).
export default async function ConsultaInspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<ParamsConsulta>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { filtros, hayFiltrosActivos, valoresFormulario } = parsearFiltrosConsulta(await searchParams);

  const inspecciones = await getAllInspeccionesForOversight({
    ...filtros,
    // El Supervisor Oleariari solo consulta las inspecciones de su sede.
    sede: session.user.role === Role.SUPERVISOR_OLEARIARI ? Sede.OLEARIARI : undefined,
  });

  const conteo = contarPorEstado(inspecciones);
  const esSst = session.user.role === Role.SST;
  const descargables = contarDescargables(session.user.role, inspecciones);
  const queryLote = queryStringFiltros(valoresFormulario);
  const puedeVerDashboard = puedeAccederARuta(session.user.role, "/dashboard");

  return (
    <main className="flex w-full flex-1 flex-col bg-[#F5F9FD]">
      <header className="relative overflow-hidden bg-gradient-to-r from-white via-[#EAF4FC] to-[#D6EAF8]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2E9BD6]">Inspecciones</p>
            <h1 className="text-3xl font-bold leading-tight text-[#0B2A4A] sm:text-4xl">Todas las inspecciones</h1>
            <p className="max-w-md text-base text-[#17324d]">
              Consulta, filtra y revisa el historial de inspecciones registradas.
            </p>
            {puedeVerDashboard && (
              <Link href="/dashboard" className="mt-1 text-sm font-medium text-[#2E9BD6] hover:underline">
                Ver dashboard →
              </Link>
            )}
          </div>
          <div className="relative hidden h-36 w-80 shrink-0 md:block">
            <Image
              src="/logo/ess-ltda.png"
              alt="Escort Security Services"
              fill
              sizes="320px"
              className="object-contain object-right mix-blend-multiply"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section aria-labelledby="filtros-titulo" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#EAF4FC] text-[#2E9BD6]">
              <IconoFiltro />
            </span>
            <div>
              <h2 id="filtros-titulo" className="text-base font-semibold text-[#0B2A4A]">
                Filtros de búsqueda
              </h2>
              <p className="text-sm text-gray-500">
                Selecciona uno o más criterios para encontrar las inspecciones que necesitas.
              </p>
            </div>
          </div>

          <form method="GET" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Campo id="conductor" etiqueta="Conductor" icono={<IconoPersona className="size-4" />}>
                <input
                  id="conductor"
                  name="conductor"
                  type="text"
                  defaultValue={valoresFormulario.conductor}
                  placeholder="Nombre del conductor"
                  className={ENTRADA_CON_ICONO}
                />
              </Campo>
              <Campo id="placa" etiqueta="Placa" icono={<IconoCamion className="size-4" />}>
                <input
                  id="placa"
                  name="placa"
                  type="text"
                  defaultValue={valoresFormulario.placa}
                  placeholder="Placa de la unidad"
                  className={ENTRADA_CON_ICONO}
                />
              </Campo>
              <Campo id="estado" etiqueta="Estado">
                <select id="estado" name="estado" defaultValue={valoresFormulario.estado} className={ENTRADA}>
                  <option value="">Todos</option>
                  {ESTADOS_FILTRO.map((valor) => (
                    <option key={valor} value={valor}>
                      {etiquetaEstado(valor)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="fechaDesde" etiqueta="Desde" icono={<IconoCalendario className="size-4" />}>
                <input
                  id="fechaDesde"
                  name="fechaDesde"
                  type="date"
                  defaultValue={valoresFormulario.fechaDesde}
                  className={ENTRADA_CON_ICONO}
                />
              </Campo>
              <Campo id="fechaHasta" etiqueta="Hasta" icono={<IconoCalendario className="size-4" />}>
                <input
                  id="fechaHasta"
                  name="fechaHasta"
                  type="date"
                  defaultValue={valoresFormulario.fechaHasta}
                  className={ENTRADA_CON_ICONO}
                />
              </Campo>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#2E9BD6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2487bd]"
              >
                <IconoBuscar className="size-4" />
                Buscar
              </button>
              <Link
                href="/consulta-inspecciones"
                className="inline-flex items-center gap-2 rounded-lg border border-[#2E9BD6] px-5 py-2.5 text-sm font-semibold text-[#2E9BD6] hover:bg-[#EAF4FC]"
              >
                <IconoRefrescar className="size-4" />
                Limpiar filtros
              </Link>
              {esSst && (
                <BotonDescargaLote
                  cantidad={descargables}
                  href={`/api/inspecciones/pdf-lote${queryLote ? `?${queryLote}` : ""}`}
                />
              )}
            </div>
          </form>
        </section>

        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tarjeta etiqueta="Total" valor={conteo.total} icono={<IconoDocumento />} tono="bg-[#EAF4FC] text-[#2E9BD6]" />
          <Tarjeta etiqueta="Aprobadas" valor={conteo.aprobadas} icono={<IconoCheck />} tono="bg-status-ok-soft text-status-ok-ink" />
          <Tarjeta etiqueta="Pendientes" valor={conteo.pendientes} icono={<IconoReloj />} tono="bg-status-warn-soft text-status-warn-ink" />
          <Tarjeta etiqueta="Canceladas" valor={conteo.canceladas} icono={<IconoX />} tono="bg-status-neutral-soft text-status-neutral-ink" />
        </section>

        <section aria-labelledby="resultados-titulo" className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <h2 id="resultados-titulo" className="text-base font-semibold text-[#0B2A4A]">
              Resultados de inspecciones
            </h2>
            <p className="text-sm text-gray-500">
              {conteo.total} {etiquetaConteo(conteo.total, "inspección encontrada", "inspecciones encontradas")}
            </p>
          </div>

          {inspecciones.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              {hayFiltrosActivos
                ? "No se encontraron inspecciones con esos filtros."
                : "No hay inspecciones registradas."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {inspecciones.map((inspection) => {
                const etapa = estadoEtapaOleariari({
                  ...inspection,
                  firmaSupervisorOleariari: inspection._count.firmas > 0,
                });
                return (
                  <li key={inspection.id}>
                    {/* Fila entera clickeable vía el link estirado de "Ver detalle"
                        (after:inset-0); "Ver PDF" va encima con z-10 porque no se
                        pueden anidar enlaces. */}
                    <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm hover:bg-[#F5F9FD]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FC] text-[#2E9BD6]">
                        <IconoCamion />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-bold text-[#0B2A4A]">{inspection.vehicle.placa}</span>
                        <span className="text-xs text-gray-500">Placa</span>
                      </span>
                      <span aria-hidden="true" className="hidden h-8 w-px bg-gray-200 sm:block" />
                      <span className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-700">
                          <Dato icono={<IconoPersona className="size-4" />}>{inspection.worker.name}</Dato>
                          <Dato icono={<IconoCalendario className="size-4" />}>{formatFechaCorta(inspection.startedAt)}</Dato>
                          <Dato icono={<IconoReloj className="size-4" />}>
                            {formatHora(inspection.startedAt)} – {formatHora(inspection.completedAt)}
                          </Dato>
                        </span>
                        {etapa && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-[#2E9BD6]">
                            <IconoDocumento className="size-3.5" />
                            {etapa}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex items-center gap-4">
                        <PillEstado status={inspection.status} />
                        {puedeDescargarPdf(session.user.role, inspection.status) && (
                          <a
                            href={`/api/inspecciones/${inspection.id}/pdf`}
                            download
                            className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-[#1565D8]/30 bg-white px-3 py-1 font-medium text-[#1565D8] hover:bg-[#EAF4FC]"
                          >
                            <IconoDocumento className="size-4" />
                            Ver PDF
                          </a>
                        )}
                        <Link
                          href={`/consulta-inspecciones/${inspection.id}`}
                          className="inline-flex items-center gap-0.5 font-medium text-[#2E9BD6] after:absolute after:inset-0"
                        >
                          Ver detalle
                          <IconoChevron className="size-4" />
                        </Link>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none";
const ENTRADA_CON_ICONO = `${ENTRADA} pl-9`;

const CLASES_BOTON_LOTE = "inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold";

function BotonDescargaLote({ cantidad, href }: { cantidad: number; href: string }) {
  const excede = cantidad > MAX_PDFS_POR_LOTE;
  if (cantidad === 0 || excede) {
    return (
      <span className="inline-flex items-center gap-3">
        <span
          role="link"
          aria-disabled="true"
          className={`${CLASES_BOTON_LOTE} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}
        >
          <IconoDocumento className="size-4" />
          Descargar PDFs ({cantidad})
        </span>
        {excede && <span className="text-xs text-gray-500">Máximo {MAX_PDFS_POR_LOTE}; acota el filtro</span>}
      </span>
    );
  }
  return (
    <a
      href={href}
      download
      className={`${CLASES_BOTON_LOTE} border-[#1565D8]/30 text-[#1565D8] hover:bg-[#EAF4FC]`}
    >
      <IconoDocumento className="size-4" />
      Descargar PDFs ({cantidad})
    </a>
  );
}

function Campo({
  id,
  etiqueta,
  icono,
  children,
}: {
  id: string;
  etiqueta: string;
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">
        {etiqueta}
      </label>
      <div className="relative">
        {icono && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icono}</span>
        )}
        {children}
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  icono,
  tono,
}: {
  etiqueta: string;
  valor: number;
  icono: React.ReactNode;
  tono: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${tono}`}>{icono}</span>
      <div>
        <p className="text-sm text-gray-500">{etiqueta}</p>
        <p className="text-2xl font-bold text-[#0B2A4A]">{valor}</p>
        <p className="text-xs text-gray-500">{etiquetaConteo(valor, "inspección", "inspecciones")}</p>
      </div>
    </div>
  );
}

function Dato({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-gray-400">{icono}</span>
      {children}
    </span>
  );
}

const CLASES_PILL: Record<TonoEstado, string> = {
  ok: "bg-status-ok-soft text-status-ok-ink",
  falla: "bg-status-crit-soft text-status-crit-ink",
  aviso: "bg-status-warn-soft text-status-warn-ink",
  info: "bg-status-info-soft text-status-info-ink",
  neutro: "bg-status-neutral-soft text-status-neutral-ink",
};

function PillEstado({ status }: { status: string }) {
  const icono =
    status === "APROBADA" ? (
      <IconoCheck className="size-3.5" />
    ) : status === "CANCELADA" ? (
      <IconoX className="size-3.5" />
    ) : (
      <IconoReloj className="size-3.5" />
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${CLASES_PILL[tonoEstado(status)]}`}
    >
      {icono}
      {etiquetaEstado(status)}
    </span>
  );
}
