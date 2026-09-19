import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";
import { registrarKilometraje } from "@/lib/inspections/actions";
import { imagenKilometraje } from "@/lib/inspections/imagenes";
import { ImagenReferencia } from "@/app/(worker)/inspecciones/_components/ImagenReferencia";

// Primer paso del flujo guiado: medida directa de la inspección
// (kilometraje). No es un ítem de checklist conforme/no-conforme — ver
// comentario en prisma/schema.prisma.
export default async function MedidasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  async function guardarMedidas(formData: FormData) {
    "use server";
    const kilometraje = Number(formData.get("kilometraje"));

    await registrarKilometraje(id, { kilometraje });
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Kilometraje del vehículo</h1>
      </div>

      <form action={guardarMedidas} className="flex flex-col gap-5">
        <div>
          <ImagenReferencia
            src={imagenKilometraje(inspection.vehicle.tipoVehiculo)}
            alt="Referencia visual: kilometraje"
            className="mb-2 max-h-[28rem]"
          />
          <label htmlFor="kilometraje" className="mb-1 block text-sm font-medium text-gray-700">
            Kilometraje
          </label>
          <input
            id="kilometraje"
            name="kilometraje"
            type="number"
            inputMode="numeric"
            min={0}
            required
            defaultValue={inspection.kilometraje ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="mt-2 w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
