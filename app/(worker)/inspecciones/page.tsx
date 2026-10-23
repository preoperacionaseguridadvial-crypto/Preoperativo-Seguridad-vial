import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { iniciarInspeccion, cancelarInspeccion } from "@/lib/inspections/actions";
import {
  getChecklistCatalog,
  getChecklistEstadoCompleto,
  getInspeccionesEnProcesoDelTrabajador,
} from "@/lib/inspections/queries";
import { contarProgresoChecklist } from "@/lib/inspections/progreso-checklist";
import { pasosInicio } from "@/lib/inspections/pasos-inicio";
import { esReutilizable } from "@/lib/inspections/reuso-inspeccion";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";
import { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { CLASES_TONO } from "@/lib/inicio/accion-trabajador";
import { alertasDocumentosVehiculo, chipsDocumentosVehiculo } from "@/lib/inicio/vencimientos-vehiculo";
import {
  IconoCarro,
  IconoDePaso,
  IconoEscudo,
  IconoFlecha,
  IconoFlechaDerecha,
  IconoMoto,
  IconoPlay,
  IconoReloj,
} from "@/app/_components/inicio/Iconos";
import { BotonIniciarInspeccion } from "./_components/BotonIniciarInspeccion";
import { BotonDescartarInspeccion } from "./_components/BotonDescartarInspeccion";
import { CLASES_BOTON_PRINCIPAL } from "./_components/clasesBotonPrincipal";

// Punto de entrada del flujo del trabajador (Fase 2): iniciar una inspección
// nueva sobre SU vehículo (1:1, ya no elige entre varios), o retomar una que
// quedó EN_PROCESO. Desde 2026-10-23: banda con foto de fondo, tarjetas
// "Unidad asignada" / duración, un solo botón grande según el estado y la
// vista previa de los 5 pasos. Mobile-first (los recorredores usan celular).
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
    // Igual que cancelar: un rechazo de negocio (p. ej. fuera de horario) se
    // muestra como aviso en la página; sin esto, en producción Next oculta el
    // mensaje y el recorredor ve una pantalla de error genérica.
    let inspectionId: string;
    try {
      inspectionId = (await iniciarInspeccion(vehicleId)).id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar la inspección.";
      redirect(`/inspecciones?error=${encodeURIComponent(message)}`);
    }
    redirect(`/inspecciones/${inspectionId}`);
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
  const vigentes = enProceso.filter((inspection) => esReutilizable(inspection.startedAt, ahora));
  const hayEnProcesoVigente = vigentes.length > 0;
  const inspeccionVigente = vigentes.reduce<(typeof vigentes)[number] | null>(
    (reciente, inspection) => (!reciente || inspection.startedAt > reciente.startedAt ? inspection : reciente),
    null,
  );
  const alertas = vehiculo ? alertasDocumentosVehiculo(vehiculo, ahora) : [];
  const esCarro = vehiculo?.tipoVehiculo === "CARRO";
  const descripcionVehiculo = vehiculo
    ? [[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" "), vehiculo.color].filter(Boolean).join(" · ")
    : "";
  const pasos = pasosInicio(totalItems);
  // Las tarjetas se montan sobre el borde inferior de la banda; si hay un
  // aviso de error antes de ellas, es el aviso quien sube.
  const subir = "-mt-12 sm:-mt-14";

  return (
    <main className="flex w-full flex-1 flex-col pb-10">
      <section
        className="relative isolate bg-cover bg-[position:65%_center] bg-no-repeat"
        style={{ backgroundImage: "url('/inspecciones/fondo-recorredor.webp')" }}
      >
        {/* Velo: legibilidad del texto a la izquierda y desvanecido hacia el fondo de la página. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-white/75 via-white/30 to-transparent sm:from-white/50"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-b from-transparent to-page" />
        <div className="relative mx-auto flex w-full max-w-[1350px] items-end justify-between gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
          <header className="flex max-w-xl flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1565D8]">
              Seguridad vial, siempre contigo
            </p>
            <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-5xl">Inspección preoperacional</h1>
            <p className="text-base text-ink-muted sm:text-lg">Revisa tu vehículo antes de salir a operar.</p>
          </header>
          {/* El PNG trae fondo blanco: multiply lo funde con el fondo claro de la banda.
              En pantallas grandes va centrado en la banda; en tablet, a la derecha
              (centrado chocaría con el título). */}
          <Image
            src="/logo/ess-ltda.png"
            alt="Escort Security Services"
            width={140}
            height={158}
            className="hidden h-28 w-auto self-center mix-blend-multiply sm:block lg:absolute lg:left-1/2 lg:top-1/2 lg:h-36 lg:-translate-x-1/2 lg:-translate-y-[60%]"
          />
        </div>
      </section>

      <div className="relative z-10 mx-auto flex w-full max-w-[1350px] flex-col gap-5 px-4 sm:px-6">
        {error && (
          // Bien visible: es lo que explica por qué no pudo iniciar (p. ej. fuera de horario).
          <div
            role="alert"
            className={`${subir} flex items-start gap-4 rounded-2xl border-2 border-[#D92D20] border-l-8 bg-[#FEF3F2] px-5 py-4 shadow-lg`}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D92D20] text-white"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
                <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="pt-1.5 text-base font-semibold leading-snug text-[#7A271A] sm:text-lg">{error}</p>
          </div>
        )}

        {!vehiculo && (
          <p
            className={`${error ? "" : subir} rounded-2xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink shadow-sm`}
          >
            Pendiente de asignación de vehículo: solicita al Administrador SST o al Administrador que complete tu hoja de vida.
          </p>
        )}

        {vehiculo && (
          <div className={`grid gap-4 lg:grid-cols-[2fr_1fr] ${error ? "" : subir}`}>
            <article className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:p-5">
              {fotoVehiculoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
                <img
                  src={fotoVehiculoUrl}
                  alt={`Foto del vehículo ${vehiculo.placa}`}
                  className="h-44 w-full shrink-0 rounded-xl border border-border bg-page object-cover sm:h-36 sm:w-56"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-status-info-soft text-status-info-ink sm:h-36 sm:w-56"
                >
                  {esCarro ? <IconoCarro className="size-16" /> : <IconoMoto className="size-16" />}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="w-fit rounded-full bg-status-info-soft px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#1565D8]">
                  Unidad asignada
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border-2 border-ink/70 bg-[#FFD43B] px-3 py-1 font-mono text-xl font-extrabold tracking-widest text-ink">
                    {vehiculo.placa}
                  </span>
                  <span className="text-base font-medium text-ink">{esCarro ? "Carro" : "Moto"}</span>
                </div>
                {descripcionVehiculo && <p className="text-sm text-ink-muted">{descripcionVehiculo}</p>}
                <ul className="flex flex-wrap gap-1.5">
                  {chipsDocumentosVehiculo(vehiculo, ahora).map((chip) => (
                    <li key={chip.documento}>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASES_TONO[chip.tono]}`}>
                        {chip.texto}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <aside className="flex flex-col justify-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-md sm:p-5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-status-info-soft text-[#1565D8]"
                >
                  <IconoReloj />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-ink-muted">Duración estimada</span>
                  <span className="text-xl font-bold text-ink">5 – 7 min</span>
                  <span className="text-xs text-ink-muted">5 pasos para completar</span>
                </div>
              </div>
              <hr className="border-border" />
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-status-info-soft text-[#1565D8]"
                >
                  <IconoEscudo />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">Inspección obligatoria</span>
                  <span className="text-xs text-ink-muted">Tu seguridad y la de todos empieza aquí.</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {vehiculo && !vehiculo.activo && (
          <p className="rounded-2xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink">
            Tu vehículo {vehiculo.placa} está inactivo. Solicita al Administrador SST o al Administrador que lo reactive.
          </p>
        )}

        {alertas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {alertas.map((alerta) => (
              <li
                key={alerta.documento}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
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
                    className="flex flex-col gap-3 rounded-2xl border border-status-info-ink/30 border-l-4 border-l-status-info-ink bg-surface p-3 shadow-sm"
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

        {vehiculo?.activo && inspeccionVigente && (
          <Link href={`/inspecciones/${inspeccionVigente.id}`} className={CLASES_BOTON_PRINCIPAL}>
            <IconoPlay />
            <span className="flex-1 text-center">Continuar inspección</span>
            <IconoFlechaDerecha />
          </Link>
        )}

        {vehiculo && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-bold text-ink">Qué vas a revisar</h2>
              <p className="text-sm text-ink-muted">Sigue estos 5 pasos para completar tu inspección preoperacional.</p>
            </div>
            <ol className="flex flex-col gap-2.5">
              {pasos.map((paso, indice) => (
                <li
                  key={paso.titulo}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3 shadow-sm sm:gap-4 sm:px-4"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1565D8] text-sm font-bold text-white"
                  >
                    {indice + 1}
                  </span>
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-status-info-soft text-[#1565D8]"
                  >
                    <IconoDePaso icono={paso.icono} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink sm:text-base">{paso.titulo}</span>
                    <span className="text-xs text-ink-muted sm:text-sm">{paso.subtitulo}</span>
                  </div>
                  <IconoFlecha />
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
