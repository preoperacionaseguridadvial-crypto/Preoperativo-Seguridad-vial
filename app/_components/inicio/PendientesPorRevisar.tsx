import Link from "next/link";
import type { PendienteConFoto } from "@/lib/inspections/pendientes-con-foto";
import { requiereAtencionPendiente } from "@/lib/inspections/estado-conductor";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";
import { estadoPlazoParaAprobador } from "@/lib/horarios/estado-plazo-aprobador";
import { formatFechaHora } from "@/lib/fechas/formato";
import { estadoVencimiento, resumirPendientes, textoPlazoAprobador } from "@/lib/inicio/pendientes-aprobador";
import { IconoCarro, IconoFlecha, IconoMoto, IconoReloj } from "./Iconos";
import { IconoAlerta, IconoBandera, IconoDocumento, IconoEnviado } from "./IconosAprobador";
import { MiniaturaVehiculo } from "./MiniaturaVehiculo";

function Contador({ className, icono, children }: { className: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${className}`}>
      {icono}
      {children}
    </span>
  );
}

function Chip({ className, icono, children }: { className: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {icono}
      {children}
    </span>
  );
}

function FilaPendiente({
  inspection,
  ahora,
  habilitacionHasta,
}: {
  inspection: PendienteConFoto;
  ahora: Date;
  habilitacionHasta: Date | null;
}) {
  const esCarro = inspection.vehicle.tipoVehiculo === "CARRO";
  const novedades = inspection._count.novedades;
  const espera = tiempoTranscurrido(inspection.completedAt, ahora);
  const plazo = textoPlazoAprobador(estadoPlazoParaAprobador({ inspection, ahora, habilitacionHasta }));
  const vencimiento = estadoVencimiento(inspection, ahora);
  const prioridadAlta = requiereAtencionPendiente(inspection);
  const href = `/aprobaciones/${inspection.id}`;

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-4">
        <MiniaturaVehiculo url={inspection.fotoVehiculoUrl} placa={inspection.vehicle.placa} esCarro={esCarro} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#FFD43B] px-2.5 py-0.5 font-mono text-sm font-bold tracking-wider text-[#0B2A4A]">
              {inspection.vehicle.placa}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
              {esCarro ? <IconoCarro className="size-5" /> : <IconoMoto className="size-5" />}
              {esCarro ? "Carro" : "Moto"}
            </span>
          </div>
          <p className="truncate text-base font-semibold text-[#0B2A4A]">{inspection.worker.name}</p>
          {espera && (
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <IconoEnviado />
              <span>
                Enviada {espera} · {formatFechaHora(inspection.completedAt)}
              </span>
            </p>
          )}
          {plazo && (
            <p
              className={`flex items-center gap-1.5 text-sm ${
                plazo.vencido ? "font-semibold text-status-crit-ink" : "text-ink-muted"
              }`}
            >
              <IconoReloj className="size-4 shrink-0" />
              <span>{plazo.texto}</span>
            </p>
          )}
          {(vencimiento || novedades > 0 || prioridadAlta) && (
            <div className="mt-1 flex flex-wrap gap-2">
              {vencimiento === "vencida" && (
                <Chip className="bg-status-crit-soft text-status-crit-ink" icono={<IconoReloj className="size-4" />}>
                  Vencida
                </Chip>
              )}
              {vencimiento === "por_vencer" && (
                <Chip className="bg-status-warn-soft text-status-warn-ink" icono={<IconoReloj className="size-4" />}>
                  Por vencer
                </Chip>
              )}
              {novedades > 0 && (
                <Chip className="bg-status-warn-soft text-status-warn-ink" icono={<IconoAlerta />}>
                  {novedades} {novedades === 1 ? "novedad" : "novedades"}
                </Chip>
              )}
              {prioridadAlta && (
                <Chip className="bg-status-crit-soft text-status-crit-ink" icono={<IconoBandera />}>
                  Prioridad alta
                </Chip>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 lg:border-l lg:border-border lg:pl-5">
        <Link
          href={href}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1565D8] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F55B8] active:bg-[#0F55B8] lg:flex-none"
        >
          <IconoDocumento className="size-5" />
          Revisar inspección
        </Link>
        <Link
          href={href}
          aria-label={`Abrir inspección ${inspection.vehicle.placa}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-page text-[#0B2A4A] hover:bg-[#E3F0FB]"
        >
          <IconoFlecha className="size-5" />
        </Link>
      </div>
    </li>
  );
}

/** Aprobadores: tarjeta "Pendientes por revisar" con contadores y una fila por inspección (ya ordenadas). */
export function PendientesPorRevisar({
  pendientes,
  ahora,
  habilitacionHasta = null,
}: {
  pendientes: PendienteConFoto[];
  ahora: Date;
  habilitacionHasta?: Date | null;
}) {
  const resumen = resumirPendientes(pendientes, ahora);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-[#E3F0FB] text-[#1565D8]">
            <IconoDocumento className="size-6" />
          </span>
          <h2 className="text-xl font-bold text-[#0B2A4A]">Pendientes por revisar</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Contador className="bg-[#E3F0FB] text-[#1565D8]" icono={<IconoDocumento className="size-4" />}>
            {resumen.total} {resumen.total === 1 ? "pendiente" : "pendientes"}
          </Contador>
          <Contador className="bg-status-warn-soft text-status-warn-ink" icono={<IconoAlerta />}>
            {resumen.conNovedades} con novedades
          </Contador>
          <Contador className="bg-status-crit-soft text-status-crit-ink" icono={<IconoReloj className="size-4" />}>
            {resumen.vencidas} {resumen.vencidas === 1 ? "vencida" : "vencidas"}
          </Contador>
        </div>
      </div>

      {pendientes.length === 0 ? (
        <p className="rounded-xl bg-page px-4 py-6 text-center text-sm text-ink-muted">
          No tienes inspecciones pendientes por revisar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((inspection) => (
            <FilaPendiente
              key={inspection.id}
              inspection={inspection}
              ahora={ahora}
              habilitacionHasta={habilitacionHasta}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
