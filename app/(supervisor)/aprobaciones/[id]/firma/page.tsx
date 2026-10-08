import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getInspeccionDetalleOrNotFound } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { guardarFirmaSupervisor } from "@/lib/inspections/firma-actions";
import { FirmaCanvas } from "@/app/_components/FirmaCanvas";
import { urlInicioTrasFirma } from "@/lib/inspections/aviso-decision";
import { Role, TipoFirma } from "@/generated/prisma/enums";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";
import { esRolAprobador, tipoFirmaPendiente } from "@/lib/inspections/cola-aprobacion";

// Paso posterior a la decisión del aprobador (Aprobar/Rechazar en
// app/(supervisor)/aprobaciones/[id]/page.tsx, que redirige acá si la
// decisión es propia y todavía no tiene firma). Cada aprobador firma SU
// decisión (Supervisor Oleariari: primera etapa; Director de Operaciones: la
// definitiva) y solo el mismo usuario que decidió puede completar este paso —
// ver `tipoFirmaPendiente` acá y la validación real de backend en
// `guardarFirmaSupervisor` (lib/inspections/firma-actions.ts).
export default async function AprobacionFirmaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const rol = session.user.role;
  if (!esRolAprobador(rol)) {
    redirect("/");
  }

  const inspection = await getInspeccionDetalleOrNotFound(id);
  const { supervisor: firmaSupervisor, supervisorOleariari: firmaSupervisorOleariari } =
    await getFirmasInspeccion(id);
  const tiposFirmados: TipoFirma[] = [
    ...(firmaSupervisor ? [TipoFirma.SUPERVISOR] : []),
    ...(firmaSupervisorOleariari ? [TipoFirma.SUPERVISOR_OLEARIARI] : []),
  ];
  // Sin decisión propia o ya firmada: nada que firmar acá.
  if (!tipoFirmaPendiente(rol, session.user.id, inspection, tiposFirmados)) {
    redirect(`/aprobaciones/${id}`);
  }
  const primeraEtapa = rol === Role.SUPERVISOR_OLEARIARI;

  async function guardarFirmaAction(formData: FormData) {
    "use server";
    try {
      await guardarFirmaSupervisor(id, formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la firma.";
      redirect(`/aprobaciones/${id}/firma?error=${encodeURIComponent(message)}`);
    }
    // Firmada la decisión, el trabajo con esta inspección terminó: se vuelve
    // al Inicio del Supervisor (con un aviso de confirmación) para seguir con
    // la próxima, en vez de dejar al Supervisor en el detalle.
    redirect(urlInicioTrasFirma(inspection.status, inspection.vehicle.placa, primeraEtapa));
  }

  // En la primera etapa la inspección sigue pendiente (pasa al Director): solo
  // un rechazo la cierra.
  const rechazada = inspection.status === "RECHAZADA";
  const aprobada = !rechazada;
  const siguiente = primeraEtapa && aprobada ? ` · pasa al ${etiquetaRol(Role.SUPERVISOR)}` : "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Firma del {etiquetaRol(rol)}</h1>
      </div>

      <section
        className={`rounded-md p-4 text-sm ${
          aprobada ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
        }`}
      >
        <p className="text-xs uppercase tracking-wide opacity-70">Decisión registrada</p>
        <p className="text-lg font-semibold">
          {aprobada ? "✓ Aprobada" : "✕ Rechazada"}
          {siguiente}
        </p>
      </section>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-md border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-500">Nombre y firma del {etiquetaRol(rol).toLowerCase()}</h2>
        <FirmaCanvas guardarAction={guardarFirmaAction} etiqueta="Dibujá tu firma con el dedo o el mouse" />
      </div>
    </main>
  );
}
