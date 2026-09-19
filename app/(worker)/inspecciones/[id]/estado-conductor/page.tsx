import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";
import { registrarRespuestaEstadoConductor } from "@/lib/inspections/actions";
import { GaleriaReferencia } from "@/app/(worker)/inspecciones/_components/GaleriaReferencia";
import {
  PREGUNTAS_ESTADO_CONDUCTOR,
  siguientePreguntaEstadoConductor,
} from "@/lib/inspections/estado-conductor";

// Declaración de estado del conductor (Fase soporte-moto-carro, Slice 3,
// A6): 3 preguntas sí/no del formato, textuales — ver spec. Se muestran de a
// una, una pantalla por pregunta y en orden (pedido del dueño de producto,
// 2026-09-18): `?paso=N` elige cuál; sin `paso` se abre la primera sin
// responder, así se puede retomar a mitad de camino. Cada respuesta se guarda
// sola. Ninguna respuesta bloquea el paso (D8, confirmado): la única
// advertencia que genera una respuesta "preocupante" es para el Supervisor más
// adelante (ver lib/inspections/estado-conductor.ts), nunca acá.
export default async function EstadoConductorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string; error?: string }>;
}) {
  const { id } = await params;
  const { paso, error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  const numero = Number(paso);
  const pregunta = Number.isInteger(numero) ? PREGUNTAS_ESTADO_CONDUCTOR[numero - 1] : undefined;
  if (!pregunta) {
    const siguiente = siguientePreguntaEstadoConductor(inspection);
    redirect(
      siguiente === null ? await getNextStepPath(id) : `/inspecciones/${id}/estado-conductor?paso=${siguiente}`,
    );
  }

  const campo = pregunta.campo;
  const respuestaActual = inspection[campo];

  async function guardarRespuestaAction(formData: FormData) {
    "use server";
    const respuesta = formData.get("respuesta");

    try {
      if (respuesta !== "si" && respuesta !== "no") {
        throw new Error("Selecciona una respuesta para continuar.");
      }
      await registrarRespuestaEstadoConductor(id, campo, respuesta === "si");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la respuesta.";
      redirect(`/inspecciones/${id}/estado-conductor?paso=${numero}&error=${encodeURIComponent(message)}`);
    }
    redirect(await getNextStepPath(id));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Declaración del conductor</h1>
        <p className="mt-1 text-xs text-gray-500">
          Pregunta {numero} de {PREGUNTAS_ESTADO_CONDUCTOR.length}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <GaleriaReferencia srcs={[pregunta.imagen]} alt="Ilustración de la pregunta" />

      <form action={guardarRespuestaAction} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">{pregunta.texto}</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="respuesta"
                value="no"
                required
                defaultChecked={respuestaActual === false}
                className="h-4 w-4"
              />{" "}
              No
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="respuesta"
                value="si"
                defaultChecked={respuestaActual === true}
                className="h-4 w-4"
              />{" "}
              Sí
            </label>
          </div>
          {pregunta.ayudaSi && <p className="text-xs text-amber-700">{pregunta.ayudaSi}</p>}
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Continuar
        </button>
      </form>

      {numero > 1 && (
        <Link
          href={`/inspecciones/${id}/estado-conductor?paso=${numero - 1}`}
          className="text-sm text-[#005B96] hover:underline"
        >
          ← Pregunta anterior
        </Link>
      )}
    </main>
  );
}
