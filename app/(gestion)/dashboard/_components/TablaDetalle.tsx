import Link from "next/link";
import type { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { estadoLegible } from "@/lib/inspections/reportes-queries";
import { buildDashboardUrl } from "./dashboard-url";

type Inspeccion = Awaited<ReturnType<typeof getAllInspeccionesForOversight>>[number];

const FILAS_POR_PAGINA = 25;

/**
 * Tabla de detalle paginada (25 filas), última sección del dashboard. Cada
 * fila abre el detalle de solo lectura (`consulta-inspecciones/[id]`, ya
 * existente) y descarga el PDF FO-SVS-23 (`/api/inspecciones/[id]/pdf`, ya
 * existente, sin tocar) — no se reimplementa ninguna de las dos.
 */
export function TablaDetalle({
  inspecciones,
  page,
  searchParams,
  role,
}: {
  inspecciones: Inspeccion[];
  page: number;
  searchParams: Record<string, string | undefined>;
  role: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(inspecciones.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(Math.max(1, page), totalPaginas);
  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  const filas = inspecciones.slice(inicio, inicio + FILAS_POR_PAGINA);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Detalle de inspecciones</h2>

      {filas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2 font-medium">Fecha</th>
                  <th className="py-2 pr-2 font-medium">Hora</th>
                  <th className="py-2 pr-2 font-medium">Trabajador</th>
                  <th className="py-2 pr-2 font-medium">Placa</th>
                  <th className="py-2 pr-2 text-right font-medium">Km</th>
                  <th className="py-2 pr-2 font-medium">Estado</th>
                  <th className="py-2 pr-2 font-medium">Resultado</th>
                  <th className="py-2 pr-2 text-right font-medium">Novedades</th>
                  <th className="py-2 pr-2 font-medium">Supervisor</th>
                  <th className="py-2 pr-2 font-medium">Aprobación</th>
                  <th className="py-2 pr-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((insp) => (
                  <tr key={insp.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-2">
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(insp.startedAt)}
                    </td>
                    <td className="py-2 pr-2">
                      {new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(insp.startedAt)}
                    </td>
                    <td className="py-2 pr-2 font-medium text-[#0B3B60]">{insp.worker.name}</td>
                    <td className="py-2 pr-2">{insp.vehicle.placa}</td>
                    <td className="py-2 pr-2 text-right">{insp.kilometraje ?? "—"}</td>
                    <td className="py-2 pr-2">{estadoLegible(insp.status)}</td>
                    <td className="py-2 pr-2">{insp.puedeOperar === null ? "—" : insp.puedeOperar ? "Sí" : "No"}</td>
                    <td className="py-2 pr-2 text-right">{insp._count.novedades}</td>
                    <td className="py-2 pr-2">{insp.supervisor?.name ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {insp.reviewedAt === null ? "Pendiente" : estadoLegible(insp.status)}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <Link href={`/consulta-inspecciones/${insp.id}`} className="text-[#2E9BD6] hover:underline">
                        Ver
                      </Link>
                      {role === "SST" && (
                        <>
                          {" · "}
                          <a href={`/api/inspecciones/${insp.id}/pdf`} className="text-[#2E9BD6] hover:underline">
                            PDF
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Página {paginaActual} de {totalPaginas} — {inspecciones.length} inspecciones
            </span>
            <div className="flex gap-3">
              {paginaActual > 1 && (
                <Link
                  href={buildDashboardUrl("/dashboard", searchParams, { page: String(paginaActual - 1) })}
                  className="text-[#2E9BD6] hover:underline"
                >
                  ← Anterior
                </Link>
              )}
              {paginaActual < totalPaginas && (
                <Link
                  href={buildDashboardUrl("/dashboard", searchParams, { page: String(paginaActual + 1) })}
                  className="text-[#2E9BD6] hover:underline"
                >
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
