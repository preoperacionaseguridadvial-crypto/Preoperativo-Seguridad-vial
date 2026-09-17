import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { crearVehiculo } from "@/lib/admin/vehicle-actions";

export default async function NuevoVehiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function crearAction(formData: FormData) {
    "use server";
    const fechaRaw = formData.get("fechaVencimientoTecnicomecanica")?.toString();
    try {
      await crearVehiculo({
        placa: formData.get("placa")?.toString() ?? "",
        tipo: formData.get("tipo")?.toString() ?? "",
        fechaVencimientoTecnicomecanica: fechaRaw ? new Date(fechaRaw) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el vehículo.";
      redirect(`/admin/vehiculos/nuevo?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/vehiculos");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/vehiculos" className="text-sm text-[#005B96] hover:underline">
          ← Vehículos
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">Crear vehículo</h1>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={crearAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="placa" className="mb-1 block text-sm font-medium text-gray-700">
            Placa
          </label>
          <input
            id="placa"
            name="placa"
            type="text"
            required
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
            defaultValue="Motocicleta"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="fechaVencimientoTecnicomecanica" className="mb-1 block text-sm font-medium text-gray-700">
            Vencimiento tecnicomecánica (opcional)
          </label>
          <input
            id="fechaVencimientoTecnicomecanica"
            name="fechaVencimientoTecnicomecanica"
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Crear vehículo
        </button>
      </form>
    </main>
  );
}
