import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";
import { registrarEstadoConductor } from "@/lib/inspections/actions";

// Declaración de estado del conductor (Fase soporte-moto-carro, Slice 3,
// A6): 3 preguntas sí/no del formato, textuales — ver spec. Ninguna
// respuesta bloquea el paso (D8, confirmado): el botón siempre continúa una
// vez las 3 están contestadas, la única advertencia que genera una
// respuesta "preocupante" es para el Supervisor más adelante (ver
// lib/inspections/estado-conductor.ts), nunca acá.
export default async function EstadoConductorPage({
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

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  async function guardarEstadoAction(formData: FormData) {
    "use server";
    const tomaMedicamentos = formData.get("tomaMedicamentos") === "si";
    const condicionesAptas = formData.get("condicionesAptas") === "si";
    const consumioAlcohol = formData.get("consumioAlcohol") === "si";

    try {
      await registrarEstadoConductor(id, { tomaMedicamentos, condicionesAptas, consumioAlcohol });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la declaración.";
      redirect(`/inspecciones/${id}/estado-conductor?error=${encodeURIComponent(message)}`);
    }
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Declaración del conductor</h1>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={guardarEstadoAction} className="flex flex-col gap-6">
        <PreguntaSiNo
          name="tomaMedicamentos"
          pregunta="¿Se encuentra bajo los efectos de algún medicamento, sustancia o condición que pueda afectar su capacidad para conducir de manera segura?"
          ayudaSi='Si respondió "Sí": informar al responsable antes de iniciar el recorrido.'
        />
        <PreguntaSiNo
          name="condicionesAptas"
          pregunta="¿Se encuentra en condiciones físicas y mentales adecuadas para conducir de manera segura?"
        />
        <PreguntaSiNo
          name="consumioAlcohol"
          pregunta="¿Ha consumido alcohol o alguna sustancia que pueda afectar su capacidad para conducir?"
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

function PreguntaSiNo({
  name,
  pregunta,
  ayudaSi,
}: {
  name: string;
  pregunta: string;
  ayudaSi?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-gray-700">{pregunta}</legend>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name={name} value="no" required className="h-4 w-4" /> No
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name={name} value="si" className="h-4 w-4" /> Sí
        </label>
      </div>
      {ayudaSi && <p className="text-xs text-amber-700">{ayudaSi}</p>}
    </fieldset>
  );
}
