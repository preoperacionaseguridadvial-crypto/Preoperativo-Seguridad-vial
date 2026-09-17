import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getVehiculos } from "@/lib/admin/queries";

export default async function AdminVehiculosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const vehiculos = await getVehiculos();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B3B60]">Vehículos</h1>
          <p className="text-sm text-gray-500">Crear y editar la flota disponible para inspecciones.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/usuarios"
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Ver usuarios
          </Link>
          <Link
            href="/admin/vehiculos/nuevo"
            className="rounded-md bg-[#0B3B60] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
          >
            Crear vehículo
          </Link>
        </div>
      </div>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        {vehiculos.length === 0 ? (
          <p className="text-sm text-gray-500">No hay vehículos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2 font-medium">Placa</th>
                  <th className="py-2 pr-2 font-medium">Tipo</th>
                  <th className="py-2 pr-2 font-medium">Tipo de vehículo</th>
                  <th className="py-2 pr-2 font-medium">Vencimiento tecnicomecánica</th>
                  <th className="py-2 pr-2 font-medium">Activo</th>
                  <th className="py-2 pr-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehiculos.map((vehiculo) => (
                  <tr key={vehiculo.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-2 font-medium text-[#0B3B60]">{vehiculo.placa}</td>
                    <td className="py-2 pr-2">{vehiculo.tipo}</td>
                    <td className="py-2 pr-2">{vehiculo.tipoVehiculo ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {vehiculo.fechaVencimientoTecnicomecanica
                        ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                            vehiculo.fechaVencimientoTecnicomecanica,
                          )
                        : "—"}
                    </td>
                    <td className="py-2 pr-2">
                      {vehiculo.activo ? (
                        "Sí"
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <Link href={`/admin/vehiculos/${vehiculo.id}`} className="text-[#005B96] hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
