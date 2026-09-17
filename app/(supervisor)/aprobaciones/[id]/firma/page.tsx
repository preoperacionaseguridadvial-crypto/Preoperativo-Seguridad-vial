import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getInspeccionDetalleOrNotFound } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { guardarFirmaSupervisor } from "@/lib/inspections/firma-actions";
import { FirmaCanvas } from "@/app/_components/FirmaCanvas";

// Paso posterior a la decisión del Supervisor (Aprobar/Rechazar en
// app/(supervisor)/aprobaciones/[id]/page.tsx, que redirige acá si la
// decisión es propia y todavía no tiene firma). Solo el mismo Supervisor
// que decidió puede completar este paso — ver el chequeo de
// `supervisorId` acá y la validación real de backend en
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

  const inspection = await getInspeccionDetalleOrNotFound(id);
  if (inspection.reviewedAt === null) {
    redirect(`/aprobaciones/${id}`);
  }
  if (inspection.supervisorId !== session.user.id) {
    redirect(`/aprobaciones/${id}`);
  }

  const { supervisor: firmaSupervisor } = await getFirmasInspeccion(id);
  if (firmaSupervisor) {
    redirect(`/aprobaciones/${id}`);
  }

  async function guardarFirmaAction(formData: FormData) {
    "use server";
    try {
      await guardarFirmaSupervisor(id, formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la firma.";
      redirect(`/aprobaciones/${id}/firma?error=${encodeURIComponent(message)}`);
    }
    redirect(`/aprobaciones/${id}`);
  }

  const aprobada = inspection.status === "APROBADA";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Firma del supervisor</h1>
      </div>

      <section
        className={`rounded-md p-4 text-sm ${
          aprobada ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
        }`}
      >
        <p className="text-xs uppercase tracking-wide opacity-70">Decisión registrada</p>
        <p className="text-lg font-semibold">
          {aprobada ? "✓ Aprobada" : "✕ Rechazada"}
        </p>
      </section>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-md border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-500">Nombre y firma del supervisor</h2>
        <FirmaCanvas guardarAction={guardarFirmaAction} etiqueta="Dibujá tu firma con el dedo o el mouse" />
      </div>
    </main>
  );
}
