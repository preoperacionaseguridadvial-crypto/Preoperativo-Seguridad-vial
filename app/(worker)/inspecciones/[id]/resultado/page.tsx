import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";
import { registrarResultado } from "@/lib/inspections/actions";

// Resultado final (sección 13 del brief): declaración PERSONAL del
// conductor, no la decisión oficial "LA UNIDAD PUEDE SALIR A OPERAR" del
// formato FO-SVS-23 (esa la responde el Supervisor al aprobar/rechazar, ver
// app/(supervisor)/aprobaciones/[id]/page.tsx) — por eso la pregunta acá se
// frasea como declaración del conductor, no como el veredicto oficial.
// "No" manda a una subpantalla que exige justificación (mismo patrón que
// Conforme/No conforme del checklist).
export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  async function marcarPuedeOperar() {
    "use server";
    await registrarResultado(id, true);
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-2xl font-semibold text-[#0B3B60]">
          Señor Conductor, ¿usted declara que la unidad está en condiciones de salir a operar?
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        <form action={marcarPuedeOperar}>
          <button
            type="submit"
            className="w-full rounded-md bg-green-600 px-4 py-5 text-lg font-semibold text-white hover:bg-green-700"
          >
            ✓ Sí, declaro que está en condiciones
          </button>
        </form>

        <Link
          href={`/inspecciones/${id}/resultado/no-puede-operar`}
          className="block w-full rounded-md bg-red-600 px-4 py-5 text-center text-lg font-semibold text-white hover:bg-red-700"
        >
          ✕ No, no está en condiciones
        </Link>
      </div>
    </main>
  );
}
