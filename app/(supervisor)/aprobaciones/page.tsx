import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getInspeccionesPendientes } from "@/lib/inspections/supervisor-queries";
// "Buscar todas las inspecciones" reusa la pantalla de solo lectura de
// oversight (app/(gestion)/consulta-inspecciones), a la que SUPERVISOR ya
// tiene acceso — no se duplica una pantalla de búsqueda propia acá.

// Punto de entrada de la revisión del Supervisor (Fase 3): lista de
// inspecciones pendientes de decisión. Cualquier Supervisor puede ver y
// decidir sobre cualquier inspección pendiente — no hay asignación
// trabajador→supervisor.
export default async function AprobacionesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const pendientes = await getInspeccionesPendientes();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[#0B3B60]">Inspecciones pendientes</h1>
        <Link href="/consulta-inspecciones" className="text-sm text-[#2E9BD6] hover:underline">
          Buscar todas las inspecciones →
        </Link>
      </div>

      {pendientes.length === 0 && (
        <p className="text-sm text-gray-500">No hay inspecciones pendientes de revisión.</p>
      )}

      <ul className="flex flex-col gap-3">
        {pendientes.map((inspection) => {
          const urgente = inspection.status === "NO_APTA_PARA_OPERAR";
          return (
            <li key={inspection.id}>
              <Link
                href={`/aprobaciones/${inspection.id}`}
                className={`block rounded-md border px-4 py-3 text-sm ${
                  urgente
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#0B3B60]">
                    {inspection.vehicle.placa}
                    <span className="ml-2 font-normal text-gray-500">
                      {inspection.worker.name}
                    </span>
                  </span>
                  {urgente && (
                    <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                      NO APTA
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                  <span>Inicio: {formatFechaHora(inspection.startedAt)}</span>
                  <span>Fin: {formatFechaHora(inspection.completedAt)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function formatFechaHora(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
