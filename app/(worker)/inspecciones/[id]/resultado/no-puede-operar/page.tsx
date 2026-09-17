import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";
import { registrarResultado } from "@/lib/inspections/actions";

export default async function NoPuedeOperarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  async function guardarJustificacion(formData: FormData) {
    "use server";
    const justificacion = formData.get("justificacion")?.toString() ?? "";
    await registrarResultado(id, false, justificacion);
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Justificación</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explicá por qué el vehículo no puede operar hoy.
        </p>
      </div>

      <form action={guardarJustificacion} className="flex flex-col gap-4">
        <textarea
          name="justificacion"
          required
          minLength={3}
          rows={6}
          placeholder="Ej: llanta trasera sin presión, no es seguro circular."
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
