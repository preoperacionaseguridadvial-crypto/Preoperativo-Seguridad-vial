import Link from "next/link";
import type { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { estadoLegible } from "@/lib/inspections/reportes-queries";
import { tonoAprobacion, tonoEstado } from "./estado";
import { EstadoPill } from "./EstadoPill";

export type InspeccionDetalle = Awaited<ReturnType<typeof getAllInspeccionesForOversight>>[number];

const formatoFecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "short" });
const formatoHora = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });

/**
 * Tabla de inspecciones compartida por "Inspecciones recientes" (5 filas) y
 * "Detalle de inspecciones" (paginada). Cada fila abre el detalle de solo
 * lectura (`consulta-inspecciones/[id]`, ya existente); `conPdf` agrega la
 * descarga del PDF FO-SVS-23 (`/api/inspecciones/[id]/pdf`, ya existente y
 * restringida al rol SST — el link solo se ofrece a SST). Estado y
 * aprobación van como "píldora" con texto: el color solo refuerza.
 */
export function TablaInspecciones({
  inspecciones,
  role,
  conPdf,
}: {
  inspecciones: InspeccionDetalle[];
  role: string;
  conPdf: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Hora</th>
            <th className="py-2 pr-3 font-medium">Trabajador</th>
            <th className="py-2 pr-3 font-medium">Placa</th>
            <th className="py-2 pr-3 text-right font-medium">Km</th>
            <th className="py-2 pr-3 font-medium">Estado</th>
            <th className="py-2 pr-3 font-medium">Resultado</th>
            <th className="py-2 pr-3 text-right font-medium">Novedades</th>
            <th className="py-2 pr-3 font-medium">Supervisor</th>
            <th className="py-2 pr-3 font-medium">Aprobación</th>
            <th className="py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {inspecciones.map((insp) => (
            <tr key={insp.id} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3 whitespace-nowrap">{formatoFecha.format(insp.startedAt)}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap">{formatoHora.format(insp.startedAt)}</td>
              <td className="py-2.5 pr-3 font-medium">{insp.worker.name}</td>
              <td className="py-2.5 pr-3">{insp.vehicle.placa}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{insp.kilometraje ?? "—"}</td>
              <td className="py-2.5 pr-3">
                <EstadoPill tono={tonoEstado(insp.status)}>{estadoLegible(insp.status)}</EstadoPill>
              </td>
              <td className="py-2.5 pr-3">{insp.puedeOperar === null ? "—" : insp.puedeOperar ? "Sí" : "No"}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{insp._count.novedades}</td>
              <td className="py-2.5 pr-3">{insp.supervisor?.name ?? "—"}</td>
              <td className="py-2.5 pr-3">
                <EstadoPill tono={tonoAprobacion(insp.reviewedAt !== null, insp.status)}>
                  {insp.reviewedAt === null ? "Pendiente" : estadoLegible(insp.status)}
                </EstadoPill>
              </td>
              <td className="py-2.5 whitespace-nowrap">
                <Link href={`/consulta-inspecciones/${insp.id}`} className="font-medium text-status-info-ink hover:underline">
                  Ver
                </Link>
                {conPdf && role === "SST" && (
                  <>
                    {" · "}
                    <a href={`/api/inspecciones/${insp.id}/pdf`} className="font-medium text-status-info-ink hover:underline">
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
  );
}
