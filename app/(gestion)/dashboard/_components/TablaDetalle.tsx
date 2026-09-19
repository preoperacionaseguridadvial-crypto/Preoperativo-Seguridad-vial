import Link from "next/link";
import { buildDashboardUrl } from "./dashboard-url";
import { Tarjeta } from "./Tarjeta";
import { TablaInspecciones, type InspeccionDetalle } from "./TablaInspecciones";

const FILAS_POR_PAGINA = 25;

/**
 * Tabla de detalle paginada (25 filas), última sección del dashboard. Cada
 * fila abre el detalle de solo lectura (`consulta-inspecciones/[id]`, ya
 * existente) y, solo para el rol SST, descarga el PDF FO-SVS-23
 * (`/api/inspecciones/[id]/pdf`, ya existente, sin tocar) — no se
 * reimplementa ninguna de las dos (ver `TablaInspecciones`).
 */
export function TablaDetalle({
  inspecciones,
  page,
  searchParams,
  role,
}: {
  inspecciones: InspeccionDetalle[];
  page: number;
  searchParams: Record<string, string | undefined>;
  role: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(inspecciones.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(Math.max(1, page), totalPaginas);
  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  const filas = inspecciones.slice(inicio, inicio + FILAS_POR_PAGINA);

  return (
    <Tarjeta titulo="Detalle de inspecciones">
      {filas.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <>
          <TablaInspecciones inspecciones={filas} role={role} conPdf />

          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>
              Página {paginaActual} de {totalPaginas} — {inspecciones.length} inspecciones
            </span>
            <div className="flex gap-3">
              {paginaActual > 1 && (
                <Link
                  href={buildDashboardUrl("/dashboard", searchParams, { page: String(paginaActual - 1) })}
                  className="font-medium text-status-info-ink hover:underline"
                >
                  ← Anterior
                </Link>
              )}
              {paginaActual < totalPaginas && (
                <Link
                  href={buildDashboardUrl("/dashboard", searchParams, { page: String(paginaActual + 1) })}
                  className="font-medium text-status-info-ink hover:underline"
                >
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </Tarjeta>
  );
}
