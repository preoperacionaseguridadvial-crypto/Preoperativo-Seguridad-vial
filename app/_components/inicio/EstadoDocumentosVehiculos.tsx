import { resumenDocumentosVehiculos } from "@/lib/inicio/documentos-vehiculos";
import type { getVehiculosConDocumentosPorVencer } from "@/lib/inicio/resumen-queries";
import { VencimientosVehiculos } from "./VencimientosVehiculos";

type Vehiculos = Awaited<ReturnType<typeof getVehiculosConDocumentosPorVencer>>;

/** SST: tarjeta de estado de SOAT/tecnomecánica; si hay pendientes, el detalle va debajo. */
export function EstadoDocumentosVehiculos({ vehiculos }: { vehiculos: Vehiculos }) {
  const { alDia, texto } = resumenDocumentosVehiculos(vehiculos.length);
  const tono = alDia ? "bg-status-ok-soft text-status-ok-ink" : "bg-status-warn-soft text-status-warn-ink";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <span aria-hidden className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${tono}`}>
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
            {alDia ? (
              <path
                d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[#0B2A4A]">Documentos de vehículos</h2>
          <p className="text-sm text-ink-muted">{texto}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tono}`}>
          {alDia ? "Al día" : "Por atender"}
        </span>
      </div>
      {!alDia && <VencimientosVehiculos vehiculos={vehiculos} />}
    </section>
  );
}
