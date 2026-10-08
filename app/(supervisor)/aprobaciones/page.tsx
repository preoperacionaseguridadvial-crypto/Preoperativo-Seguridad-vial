import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getPendientesConFoto } from "@/lib/inspections/pendientes-con-foto";
import { partirPendientes } from "@/lib/inspections/partir-pendientes";
import { esRolAprobador } from "@/lib/inspections/cola-aprobacion";
import { TarjetaPendiente } from "@/app/_components/TarjetaPendiente";
// "Buscar todas las inspecciones" reusa la pantalla de solo lectura de
// oversight (app/(gestion)/consulta-inspecciones), a la que SUPERVISOR ya
// tiene acceso — no se duplica una pantalla de búsqueda propia acá.

// Punto de entrada de la revisión de los aprobadores (Fase 3 + roles-olariari):
// lista de inspecciones pendientes de decisión EN LA COLA DE SU ROL — el
// Supervisor Olariari ve las de su sede sin revisar; el Director de Operaciones
// las de Bogotá y las de Olariari que ya pasaron la primera etapa. No hay
// asignación trabajador→supervisor.
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

  const rol = session.user.role;
  if (!esRolAprobador(rol)) {
    redirect("/");
  }

  // Miniatura del vehículo firmada: ver getPendientesConFoto.
  const pendientes = await getPendientesConFoto(rol);
  const ahora = new Date();

  const { conAlerta, sinAlerta } = partirPendientes(pendientes);

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

function EstadoVacio() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-status-ok-soft text-status-ok-ink">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="font-medium text-ink">No hay inspecciones pendientes</p>
      <p className="text-sm text-ink-muted">Cuando un recorredor envíe una, aparecerá aquí.</p>
    </div>
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

