import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { iniciarInspeccion, cancelarInspeccion } from "@/lib/inspections/actions";
import { getVehiculosActivos, getInspeccionesEnProcesoDelTrabajador } from "@/lib/inspections/queries";

// Punto de entrada del flujo del trabajador (Fase 2): elegir un vehículo
// para iniciar una inspección nueva, o retomar una que quedó EN_PROCESO.
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

  const [vehiculos, enProceso] = await Promise.all([
    getVehiculosActivos(),
    getInspeccionesEnProcesoDelTrabajador(session.user.id),
  ]);

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold text-[#0B3B60]">Inspección preoperacional</h1>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Iniciar nueva inspección</h2>
        {vehiculos.length === 0 && (
          <p className="text-sm text-gray-500">No hay vehículos activos disponibles.</p>
        )}
        {vehiculos.map((vehicle) => (
          <form key={vehicle.id} action={iniciarAction.bind(null, vehicle.id)}>
            <button
              type="submit"
              className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-left text-sm font-medium text-white hover:bg-[#0B3B60]/90"
            >
              {vehicle.placa}
              <span className="block text-xs font-normal text-white/70">{vehicle.tipo}</span>
            </button>
          </form>
        ))}
      </section>

      {enProceso.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">En proceso</h2>
          {enProceso.map((inspection) => (
            <div
              key={inspection.id}
              className="flex items-stretch overflow-hidden rounded-md border border-[#2E9BD6] bg-[#2E9BD6]/5"
            >
              <Link
                href={`/inspecciones/${inspection.id}`}
                className="flex-1 px-4 py-3 text-sm font-medium text-[#0B3B60]"
              >
                Continuar inspección — {inspection.vehicle.placa}
              </Link>
              <form action={cancelarAction.bind(null, inspection.id)} className="flex items-center pr-2">
                <button
                  type="submit"
                  aria-label={`Descartar inspección ${inspection.vehicle.placa}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
