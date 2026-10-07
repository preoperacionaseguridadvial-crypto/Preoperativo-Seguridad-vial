import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getInspeccionesPendientes } from "@/lib/inspections/supervisor-queries";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";
import { getSignedReadUrl } from "@/lib/storage/s3";
// "Buscar todas las inspecciones" reusa la pantalla de solo lectura de
// oversight (app/(gestion)/consulta-inspecciones), a la que SUPERVISOR ya
// tiene acceso — no se duplica una pantalla de búsqueda propia acá.

type Pendiente = Awaited<ReturnType<typeof getInspeccionesPendientes>>[number] & {
  fotoVehiculoUrl: string | null;
};

// Punto de entrada de la revisión del Supervisor (Fase 3): lista de
// inspecciones pendientes de decisión. Cualquier Supervisor puede ver y
// decidir sobre cualquier inspección pendiente — no hay asignación
// trabajador→supervisor.
//
// Diseño mobile-first (la mayoría de los Supervisores la abre desde el
// celular): tarjetas con área táctil completa, placa grande, y las alertas
// (NO APTA, estado del conductor, novedades) visibles sin abrir el detalle.
// Las que requieren atención van en su propia sección, arriba.
export default async function AprobacionesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Miniatura del vehículo: la foto LATERAL diaria de la inspección (muestra
  // la moto/carro completo y en su estado de hoy); si falta, la foto de la
  // hoja de vida (Vehicle.fotoS3Key). Firmadas on-demand como en
  // app/(admin)/admin/usuarios/[id]/hoja-de-vida; si no hay foto o la firma
  // falla, la tarjeta cae al ícono moto/carro.
  const pendientes: Pendiente[] = await Promise.all(
    (await getInspeccionesPendientes()).map(async (inspection) => {
      const s3Key = inspection.fotos[0]?.s3Key ?? inspection.vehicle.fotoS3Key;
      return {
        ...inspection,
        fotoVehiculoUrl: s3Key ? await getSignedReadUrl(s3Key).catch(() => null) : null,
      };
    }),
  );
  const ahora = new Date();

  const conAlerta = pendientes.filter(requiereAtencion);
  const sinAlerta = pendientes.filter((inspection) => !requiereAtencion(inspection));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Aprobaciones</h1>
        <p className="text-sm text-ink-muted">
          {pendientes.length === 0
            ? "Estás al día"
            : `${pendientes.length} ${
                pendientes.length === 1 ? "inspección espera" : "inspecciones esperan"
              } tu revisión`}
        </p>
      </header>

      {pendientes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Resumen
            valor={conAlerta.length}
            etiqueta="Requieren atención"
            className="bg-status-crit-soft text-status-crit-ink"
          />
          <Resumen
            valor={sinAlerta.length}
            etiqueta="Sin alertas"
            className="bg-status-info-soft text-status-info-ink"
          />
        </div>
      )}

      {pendientes.length === 0 && <EstadoVacio />}

      {conAlerta.length > 0 && (
        <Seccion titulo="Requieren atención">
          {conAlerta.map((inspection) => (
            <TarjetaPendiente key={inspection.id} inspection={inspection} ahora={ahora} />
          ))}
        </Seccion>
      )}

      {sinAlerta.length > 0 && (
        <Seccion titulo="Por revisar">
          {sinAlerta.map((inspection) => (
            <TarjetaPendiente key={inspection.id} inspection={inspection} ahora={ahora} />
          ))}
        </Seccion>
      )}

      <Link
        href="/consulta-inspecciones"
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-brand shadow-sm active:bg-page"
      >
        <IconoBuscar />
        Buscar todas las inspecciones
      </Link>
    </main>
  );
}

function requiereAtencion(inspection: Pendiente) {
  return (
    inspection.status === "NO_APTA_PARA_OPERAR" || requiereAtencionEstadoConductor(inspection)
  );
}

function Resumen({
  valor,
  etiqueta,
  className,
}: {
  valor: number;
  etiqueta: string;
  className: string;
}) {
  return (
    <div className={`flex flex-col rounded-xl px-4 py-3 ${className}`}>
      <span className="text-2xl font-bold leading-none">{valor}</span>
      <span className="mt-1 text-xs font-medium">{etiqueta}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{titulo}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function TarjetaPendiente({ inspection, ahora }: { inspection: Pendiente; ahora: Date }) {
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
              Enviada {espera} · {formatHora(inspection.completedAt)}
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

function EstadoVacio() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-status-ok-soft text-status-ok-ink">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="font-medium text-ink">No hay inspecciones pendientes</p>
      <p className="text-sm text-ink-muted">Cuando un trabajador envíe una, aparecerá aquí.</p>
    </div>
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

function IconoBuscar() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </svg>
  );
}

function formatHora(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
