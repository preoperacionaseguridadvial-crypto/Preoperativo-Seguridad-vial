import Link from "next/link";
import { Icono } from "./Iconos";
import { Tarjeta } from "./Tarjeta";
import { TablaInspecciones, type InspeccionDetalle } from "./TablaInspecciones";

const RECIENTES = 5;

/**
 * "Inspecciones recientes": las 5 más nuevas del conjunto ya filtrado. Reusa
 * la lista que la página ya trae para la tabla de detalle (viene ordenada por
 * `startedAt` descendente), así que no agrega ninguna consulta.
 */
export function InspeccionesRecientes({ inspecciones, role }: { inspecciones: InspeccionDetalle[]; role: string }) {
  const filas = inspecciones.slice(0, RECIENTES);

  return (
    <Tarjeta
      titulo="Inspecciones recientes"
      acciones={
        <Link
          href="/consulta-inspecciones"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-status-info-ink hover:bg-page"
        >
          Ver todas las inspecciones
          <Icono nombre="flecha" className="size-3.5" />
        </Link>
      }
    >
      {filas.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <TablaInspecciones inspecciones={filas} role={role} conPdf={false} />
      )}
    </Tarjeta>
  );
}
