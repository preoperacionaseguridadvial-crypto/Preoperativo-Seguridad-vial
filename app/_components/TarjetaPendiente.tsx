import Link from "next/link";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";
import type { PendienteConFoto } from "@/lib/inspections/pendientes-con-foto";
import { formatFechaHora } from "@/lib/fechas/formato";

/**
 * Tarjeta de una inspección pendiente de decisión (Supervisor): miniatura o
 * ícono, placa, trabajador, antigüedad y alertas visibles sin abrir el
 * detalle. Compartida por /aprobaciones y el inicio del Supervisor.
 */
export function TarjetaPendiente({ inspection, ahora }: { inspection: PendienteConFoto; ahora: Date }) {
  const noApta = inspection.status === "NO_APTA_PARA_OPERAR";
  const alertaConductor = requiereAtencionEstadoConductor(inspection);
  const novedades = inspection._count.novedades;
  const esCarro = inspection.vehicle.tipoVehiculo === "CARRO";
  const espera = tiempoTranscurrido(inspection.completedAt, ahora);

  return (
    <li>
      <Link
        href={`/aprobaciones/${inspection.id}`}
        className={`flex items-center gap-3 rounded-xl border bg-surface p-3 shadow-sm transition-colors active:bg-page ${
          noApta ? "border-status-crit/40 border-l-4 border-l-status-crit" : "border-border"
        }`}
      >
        {inspection.fotoVehiculoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
          <img
            src={inspection.fotoVehiculoUrl}
            alt={`Foto del vehículo ${inspection.vehicle.placa}`}
            loading="lazy"
            className="size-20 shrink-0 rounded-lg border border-border bg-page object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-status-info-soft text-status-info-ink"
          >
            {esCarro ? <IconoCarro /> : <IconoMoto />}
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-ink/20 bg-[#fde047] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-ink">
              {inspection.vehicle.placa}
            </span>
            <span className="text-xs text-ink-muted">{esCarro ? "Carro" : "Moto"}</span>
          </div>
          <span className="truncate text-sm font-medium text-ink">{inspection.worker.name}</span>
          {espera && (
            <span className="text-xs text-ink-muted">
              Enviada {espera} · {formatFechaHora(inspection.completedAt)}
            </span>
          )}

          {(noApta || alertaConductor || novedades > 0) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {noApta && (
                <Chip className="bg-status-crit text-white">No apta para operar</Chip>
              )}
              {alertaConductor && (
                <Chip className="bg-status-crit-soft text-status-crit-ink">
                  Alerta del conductor
                </Chip>
              )}
              {novedades > 0 && (
                <Chip className="bg-status-warn-soft text-status-warn-ink">
                  {novedades} {novedades === 1 ? "novedad" : "novedades"}
                </Chip>
              )}
            </div>
          )}
        </div>

        <IconoFlecha />
      </Link>
    </li>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function IconoMoto() {
  return (
    <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5l4-6h5l4 6M14.5 10.5l-1.5-4h2.5M9.5 10.5l-1-2H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCarro() {
  return (
    <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M3 16.5v-4l2-5h14l2 5v4H3z" strokeLinejoin="round" />
      <path d="M3 12.5h18" />
      <circle cx="7" cy="16.5" r="1.8" />
      <circle cx="17" cy="16.5" r="1.8" />
    </svg>
  );
}

function IconoFlecha() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

