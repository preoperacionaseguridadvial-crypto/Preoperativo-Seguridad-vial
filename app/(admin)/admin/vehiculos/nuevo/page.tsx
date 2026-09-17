import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { crearVehiculo } from "@/lib/admin/vehicle-actions";
import { TipoVehiculo } from "@/generated/prisma/client";

const TIPOS_VEHICULO: TipoVehiculo[] = [TipoVehiculo.MOTO, TipoVehiculo.CARRO];

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
    const fechaSoatRaw = formData.get("fechaVencimientoSoat")?.toString();
    const fechaTarjetaRaw = formData.get("fechaVencimientoTarjetaTransito")?.toString();
    const foto = formData.get("foto");
    try {
      await crearVehiculo({
        placa: formData.get("placa")?.toString() ?? "",
        tipo: formData.get("tipo")?.toString() ?? "",
        tipoVehiculo: (formData.get("tipoVehiculo")?.toString() || undefined) as
          | TipoVehiculo
          | undefined,
        foto: foto instanceof File ? foto : undefined,
        marca: formData.get("marca")?.toString(),
        modelo: formData.get("modelo")?.toString(),
        color: formData.get("color")?.toString(),
        numeroMotor: formData.get("numeroMotor")?.toString(),
        numeroChasis: formData.get("numeroChasis")?.toString(),
        fechaVencimientoSoat: fechaSoatRaw ? new Date(fechaSoatRaw) : undefined,
        fechaVencimientoTarjetaTransito: fechaTarjetaRaw ? new Date(fechaTarjetaRaw) : undefined,
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

      <form action={crearAction} encType="multipart/form-data" className="flex flex-col gap-4">
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
          <label htmlFor="tipoVehiculo" className="mb-1 block text-sm font-medium text-gray-700">
            Tipo de vehículo
          </label>
          <select
            id="tipoVehiculo"
            name="tipoVehiculo"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          >
            <option value="" disabled>
              Seleccioná un tipo
            </option>
            {TIPOS_VEHICULO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium text-gray-700">Hoja de vida</legend>

          <div>
            <label htmlFor="foto" className="mb-1 block text-sm font-medium text-gray-700">
              Foto del vehículo
            </label>
            <input
              id="foto"
              name="foto"
              type="file"
              accept="image/*"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="marca" className="mb-1 block text-sm font-medium text-gray-700">
              Marca
            </label>
            <input
              id="marca"
              name="marca"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modelo" className="mb-1 block text-sm font-medium text-gray-700">
              Modelo
            </label>
            <input
              id="modelo"
              name="modelo"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="color" className="mb-1 block text-sm font-medium text-gray-700">
              Color
            </label>
            <input
              id="color"
              name="color"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="numeroMotor" className="mb-1 block text-sm font-medium text-gray-700">
              Número de motor
            </label>
            <input
              id="numeroMotor"
              name="numeroMotor"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="numeroChasis" className="mb-1 block text-sm font-medium text-gray-700">
              Número de chasis
            </label>
            <input
              id="numeroChasis"
              name="numeroChasis"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="fechaVencimientoSoat" className="mb-1 block text-sm font-medium text-gray-700">
              Vencimiento SOAT (opcional)
            </label>
            <input
              id="fechaVencimientoSoat"
              name="fechaVencimientoSoat"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="fechaVencimientoTarjetaTransito"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Vencimiento tarjeta de tránsito (opcional)
            </label>
            <input
              id="fechaVencimientoTarjetaTransito"
              name="fechaVencimientoTarjetaTransito"
              type="date"
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
        </fieldset>

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
