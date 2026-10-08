import { TarjetaPendiente } from "@/app/_components/TarjetaPendiente";
import type { PendienteConFoto } from "@/lib/inspections/pendientes-con-foto";

/**
 * SUPERVISOR: las inspecciones que esperan revisión, como las tarjetas de
 * /aprobaciones. Llegan ya ordenadas (las que requieren atención primero).
 */
export function ResumenSupervisor({ pendientes, ahora }: { pendientes: PendienteConFoto[]; ahora: Date }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Por revisar</h2>
      {pendientes.length === 0 ? (
        <p className="text-sm text-ink-muted">Estás al día.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((inspection) => (
            <TarjetaPendiente key={inspection.id} inspection={inspection} ahora={ahora} />
          ))}
        </ul>
      )}
    </section>
  );
}
