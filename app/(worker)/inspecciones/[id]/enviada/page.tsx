import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getFirmasInspeccion } from "@/lib/inspections/queries";

const MENSAJES: Record<string, string> = {
  PENDIENTE_APROBACION: "Tu inspección fue enviada y quedó pendiente de aprobación del Supervisor.",
  NO_APTA_PARA_OPERAR:
    "Tu inspección fue enviada. El vehículo quedó marcado como NO apto para operar; el Supervisor la revisará.",
  APROBADA: "Tu inspección fue aprobada por el Supervisor.",
  RECHAZADA: "Tu inspección fue rechazada por el Supervisor.",
};

// Única pantalla del flujo del trabajador donde se puede volver a ver una
// inspección ya decidida (aprobada/rechazada) — por eso, además del mensaje
// de estado, muestra la evidencia de firma manuscrita (Fase D) de ambas
// partes cuando ya existen.
export default async function InspeccionEnviadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status === "EN_PROCESO") {
    redirect(`/inspecciones/${id}`);
  }
  // Cancelada: no aplica ningún mensaje de esta pantalla (nunca se envió),
  // vuelve al punto de entrada en vez de caer en el fallback genérico.
  if (inspection.status === "CANCELADA") {
    redirect("/inspecciones");
  }

  const { conductor: firmaConductor, supervisor: firmaSupervisor } = await getFirmasInspeccion(id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-[#0B3B60]">Inspección enviada</h1>
      <p className="text-sm text-gray-600">
        {MENSAJES[inspection.status] ?? "Tu inspección fue enviada correctamente."}
      </p>

      {(firmaConductor || firmaSupervisor) && (
        <section className="flex w-full flex-col gap-4 rounded-md border border-gray-200 p-4 text-left">
          <h2 className="text-center text-sm font-medium text-gray-500">Firmas</h2>
          {firmaConductor && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-gray-500">
                Conductor — {formatFechaHora(firmaConductor.createdAt)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto. */}
              <img
                src={firmaConductor.url}
                alt="Firma del conductor"
                className="h-24 w-full max-w-xs rounded-md border border-gray-200 bg-white object-contain"
              />
              <p className="text-sm font-medium text-gray-700">{inspection.conductor.name}</p>
              {inspection.conductor.cedula && (
                <p className="text-xs text-gray-500">C.C. {inspection.conductor.cedula}</p>
              )}
            </div>
          )}
          {firmaSupervisor && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-gray-500">
                Supervisor — {formatFechaHora(firmaSupervisor.createdAt)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto. */}
              <img
                src={firmaSupervisor.url}
                alt="Firma del supervisor"
                className="h-24 w-full max-w-xs rounded-md border border-gray-200 bg-white object-contain"
              />
              {inspection.supervisor && (
                <>
                  <p className="text-sm font-medium text-gray-700">{inspection.supervisor.name}</p>
                  {inspection.supervisor.cedula && (
                    <p className="text-xs text-gray-500">C.C. {inspection.supervisor.cedula}</p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {session.user.role === "SST" && (
        <a
          href={`/api/inspecciones/${id}/pdf`}
          className="mt-2 rounded-md border border-[#0B3B60] px-4 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
        >
          Descargar PDF
        </a>
      )}

      <Link
        href="/inspecciones"
        className="mt-2 rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
      >
        Volver al inicio
      </Link>
    </main>
  );
}

function formatFechaHora(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(date);
}
