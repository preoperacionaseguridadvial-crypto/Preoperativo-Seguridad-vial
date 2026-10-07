import Link from "next/link";
import type { getResumenSupervisor } from "@/lib/inicio/resumen-queries";
import { TarjetaCifra } from "./TarjetaCifra";

/** SUPERVISOR: cuántas inspecciones esperan revisión y cuántas requieren atención. */
export function ResumenSupervisor({ resumen }: { resumen: Awaited<ReturnType<typeof getResumenSupervisor>> }) {
  const { pendientes, requierenAtencion } = resumen;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Por revisar</h2>
      <Link href="/aprobaciones" className="grid grid-cols-2 gap-3">
        <TarjetaCifra
          valor={pendientes}
          etiqueta={pendientes === 1 ? "Inspección pendiente" : "Inspecciones pendientes"}
          className="bg-status-info-soft text-status-info-ink"
        />
        <TarjetaCifra
          valor={requierenAtencion}
          etiqueta="Requieren atención"
          className={
            requierenAtencion > 0
              ? "bg-status-crit-soft text-status-crit-ink"
              : "bg-status-ok-soft text-status-ok-ink"
          }
        />
      </Link>
      {pendientes === 0 && <p className="text-sm text-ink-muted">Estás al día.</p>}
    </section>
  );
}
