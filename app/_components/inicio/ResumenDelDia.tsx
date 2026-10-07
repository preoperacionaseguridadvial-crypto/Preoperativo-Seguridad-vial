import type { getResumenDelDia } from "@/lib/inicio/resumen-queries";
import { TarjetaCifra } from "./TarjetaCifra";

const NEUTRO = "bg-status-neutral-soft text-status-neutral-ink";

/** DIRECTOR/SST: KPIs de hoy (realizadas, aprobadas, no aptas, pendientes). */
export function ResumenDelDia({ resumen }: { resumen: Awaited<ReturnType<typeof getResumenDelDia>> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Hoy</h2>
      <div className="grid grid-cols-2 gap-3">
        <TarjetaCifra
          valor={resumen.realizadas}
          etiqueta="Realizadas"
          className="bg-status-info-soft text-status-info-ink"
        />
        <TarjetaCifra
          valor={resumen.aprobadas}
          etiqueta="Aprobadas"
          className="bg-status-ok-soft text-status-ok-ink"
        />
        <TarjetaCifra
          valor={resumen.noAptas}
          etiqueta="No aptas"
          className={resumen.noAptas > 0 ? "bg-status-crit-soft text-status-crit-ink" : NEUTRO}
        />
        <TarjetaCifra
          valor={resumen.pendientes}
          etiqueta="Pendientes de revisión"
          className={resumen.pendientes > 0 ? "bg-status-warn-soft text-status-warn-ink" : NEUTRO}
        />
      </div>
    </section>
  );
}
