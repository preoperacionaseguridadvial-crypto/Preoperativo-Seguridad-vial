import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { iniciarInspeccion, cancelarInspeccion } from "@/lib/inspections/actions";
import {
  getChecklistCatalog,
  getChecklistEstadoCompleto,
  getInspeccionesEnProcesoDelTrabajador,
} from "@/lib/inspections/queries";
import { contarProgresoChecklist } from "@/lib/inspections/progreso-checklist";
import { PASOS_INSPECCION } from "@/lib/inspections/pasos-flujo";
import { esReutilizable } from "@/lib/inspections/reuso-inspeccion";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";
import { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { alertasDocumentosVehiculo } from "@/lib/inicio/vencimientos-vehiculo";
import { TarjetaVehiculo } from "@/app/_components/inicio/TarjetaVehiculo";
import { IconoDePaso } from "@/app/_components/inicio/Iconos";
import { BotonIniciarInspeccion } from "./_components/BotonIniciarInspeccion";
import { BotonDescartarInspeccion } from "./_components/BotonDescartarInspeccion";

// Punto de entrada del flujo del trabajador (Fase 2): iniciar una inspección
// nueva sobre SU vehículo (1:1, ya no elige entre varios), o retomar una que
// quedó EN_PROCESO. Mobile-first: tarjeta del vehículo (la misma del inicio),
// vista previa de los pasos, y un solo botón grande según el estado.
export default async function InspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const ahora = new Date();
  const [datos, enProceso] = await Promise.all([
    getDatosInicioTrabajador(session.user.id),
    getInspeccionesEnProcesoDelTrabajador(session.user.id),
  ]);
  const { vehiculo, fotoVehiculoUrl } = datos;

  // Progreso "N de M ítems" de cada inspección en proceso, y total de ítems
  // del checklist del vehículo para la vista previa de pasos.
  const [progresos, catalogo] = await Promise.all([
    Promise.all(
      enProceso.map(async (inspection) =>
        contarProgresoChecklist(await getChecklistEstadoCompleto(inspection.id)),
      ),
    ),
    vehiculo ? getChecklistCatalog(vehiculo.tipoVehiculo ?? "MOTO") : Promise.resolve([]),
  ]);
  const totalItems = catalogo.reduce((suma, categoria) => suma + categoria.items.length, 0);

  async function iniciarAction(vehicleId: string) {
    "use server";
    const inspection = await iniciarInspeccion(vehicleId);
    redirect(`/inspecciones/${inspection.id}`);
  }

  async function cancelarAction(inspectionId: string) {
    "use server";
    try {
      await cancelarInspeccion(inspectionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cancelar la inspección.";
      redirect(`/inspecciones?error=${encodeURIComponent(message)}`);
    }
    redirect("/inspecciones");
  }

  // Con una inspección reciente en proceso, iniciar devolvería esa misma
  // (idempotencia de `iniciarInspeccion`): el botón principal es "Continuar".
  const hayEnProcesoVigente = enProceso.some((inspection) => esReutilizable(inspection.startedAt, ahora));
  const alertas = vehiculo ? alertasDocumentosVehiculo(vehiculo, ahora) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Inspección preoperacional</h1>
        <p className="text-sm text-ink-muted">Revisa tu vehículo antes de salir a operar.</p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-status-crit-soft px-4 py-3 text-sm text-status-crit-ink">
          {error}
        </p>
      )}

      {!vehiculo && (
        <p className="rounded-xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink">
          Pendiente de asignación de vehículo: solicita al Administrador SST o al Administrador que complete tu hoja de vida.
        </p>
      )}

      {vehiculo && (
        <TarjetaVehiculo
          placa={vehiculo.placa}
          tipoVehiculo={vehiculo.tipoVehiculo}
          marca={vehiculo.marca}
          modelo={vehiculo.modelo}
          color={vehiculo.color}
          fotoUrl={fotoVehiculoUrl}
          vencimientos={vehiculo}
          ahora={ahora}
        />
      )}

      {vehiculo && !vehiculo.activo && (
        <p className="rounded-xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink">
          Tu vehículo {vehiculo.placa} está inactivo. Solicita al Administrador SST o al Administrador que lo reactive.
        </p>
      )}

      {alertas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {alertas.map((alerta) => (
            <li
              key={alerta.documento}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                alerta.estado === "VENCIDO"
                  ? "bg-status-crit-soft text-status-crit-ink"
                  : "bg-status-warn-soft text-status-warn-ink"
              }`}
            >
              {alerta.texto}
            </li>
          ))}
        </ul>
      )}

      {enProceso.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">En proceso</h2>
          <ul className="flex flex-col gap-3">
            {enProceso.map((inspection, indice) => {
              const progreso = progresos[indice];
              const porcentaje = progreso.total === 0 ? 0 : Math.round((progreso.revisados / progreso.total) * 100);
              return (
                <li
                  key={inspection.id}
                  className="flex flex-col gap-3 rounded-xl border border-status-info-ink/30 border-l-4 border-l-status-info-ink bg-surface p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md border border-ink/20 bg-[#fde047] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-ink">
                      {inspection.vehicle.placa}
                    </span>
                    <span className="text-xs text-ink-muted">
                      Iniciada {tiempoTranscurrido(inspection.startedAt, ahora)}
                    </span>
                  </div>
                  {progreso.total > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-ink">
                        {progreso.revisados} de {progreso.total} ítems revisados
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-viz-track" aria-hidden>
                        <div className="h-full rounded-full bg-viz-blue" style={{ width: `${porcentaje}%` }} />
                      </div>
                    </div>
                  )}
                  <Link
                    href={`/inspecciones/${inspection.id}`}
                    className="flex min-h-14 items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-sm active:opacity-90"
                  >
                    Continuar
                  </Link>
                  <BotonDescartarInspeccion action={cancelarAction.bind(null, inspection.id)} placa={inspection.vehicle.placa} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {vehiculo?.activo && !hayEnProcesoVigente && (
        <form action={iniciarAction.bind(null, vehiculo.id)}>
          <BotonIniciarInspeccion>Iniciar inspección</BotonIniciarInspeccion>
        </form>
      )}

      {vehiculo && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Qué vas a revisar</h2>
          <ol className="flex flex-col gap-2">
            {PASOS_INSPECCION.map((paso, indice) => (
              <li
                key={paso.clave}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-status-info-soft text-status-info-ink"
                >
                  <IconoDePaso icono={paso.icono} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-ink">
                    {indice + 1}. {paso.titulo}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {paso.clave === "checklist" && totalItems > 0
                      ? `${paso.descripcion} (${totalItems} ítems)`
                      : paso.descripcion}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
