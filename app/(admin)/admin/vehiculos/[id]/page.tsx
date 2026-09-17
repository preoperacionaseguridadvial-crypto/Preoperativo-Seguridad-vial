import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getVehiculoPorId } from "@/lib/admin/queries";
import { actualizarVehiculo } from "@/lib/admin/vehicle-actions";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditarVehiculoPage({
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

  const vehiculo = await getVehiculoPorId(id);
  if (!vehiculo) {
    notFound();
  }

  async function actualizarAction(formData: FormData) {
    "use server";
    const fechaRaw = formData.get("fechaVencimientoTecnicomecanica")?.toString();
    try {
      await actualizarVehiculo(id, {
        placa: formData.get("placa")?.toString() ?? "",
        tipo: formData.get("tipo")?.toString() ?? "",
        activo: formData.get("activo") === "on",
        fechaVencimientoTecnicomecanica: fechaRaw ? new Date(fechaRaw) : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el vehículo.";
      redirect(`/admin/vehiculos/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/vehiculos");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/vehiculos" className="text-sm text-[#005B96] hover:underline">
          ← Vehículos
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">{vehiculo.placa}</h1>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={actualizarAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="placa" className="mb-1 block text-sm font-medium text-gray-700">
            Placa
          </label>
          <input
            id="placa"
            name="placa"
            type="text"
            required
            defaultValue={vehiculo.placa}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base uppercase focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-medium text-gray-700">
            Tipo
          </label>
          <input
            id="tipo"
            name="tipo"
            type="text"
            required
            defaultValue={vehiculo.tipo}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="fechaVencimientoTecnicomecanica" className="mb-1 block text-sm font-medium text-gray-700">
            Vencimiento tecnicomecánica
          </label>
          <input
            id="fechaVencimientoTecnicomecanica"
            name="fechaVencimientoTecnicomecanica"
            type="date"
            defaultValue={toDateInputValue(vehiculo.fechaVencimientoTecnicomecanica)}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={vehiculo.activo}
            className="h-5 w-5 rounded border-gray-300 text-[#005B96] focus:ring-[#005B96]"
          />
          Vehículo activo
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Guardar cambios
        </button>
      </form>
    </main>
  );
}
