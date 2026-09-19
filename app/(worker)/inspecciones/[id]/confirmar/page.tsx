import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getInspectionForWorker,
  getFirmasInspeccion,
} from "@/lib/inspections/queries";
import { enviarInspeccion } from "@/lib/inspections/actions";
import { guardarFirmaConductor } from "@/lib/inspections/firma-actions";
import { filtrarNoConformes } from "@/lib/inspections/respuesta";
import { FirmaCanvas } from "@/app/_components/FirmaCanvas";

// Pantalla de confirmación antes de enviar (última del flujo): resume lo
// cargado y pide la firma manuscrita del conductor (Fase D) — es acá donde
// el formato oficial FO-SVS-23 declara "la unidad puede operar". El botón
// de enviar queda deshabilitado sin firma, y `enviarInspeccion` la exige de
// nuevo en el servidor (ver lib/inspections/actions.ts). Una vez enviada,
// la inspección nunca vuelve a EN_PROCESO ni se puede editar (regla de
// negocio inmutable).
export default async function ConfirmarPage({
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

  await getOwnInspectionOrNotFound(id, session.user.id);
  const inspection = await getInspectionForWorker(id);
  if (!inspection) {
    redirect("/inspecciones");
  }
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }

  // Fix (Slice 3, resiliencia): `getNextStepPath` es la única fuente de
  // verdad de qué falta (checklist, declaración de estado del conductor A6,
  // fotos diarias A7 y resultado, en ese orden) — una inspección que ya estaba
  // EN_PROCESO antes de que estas paradas existieran nunca pasó por
  // `/estado-conductor` ni `/fotos`, así que acá se vuelve a preguntar en
  // vez de asumir que, por estar EN_PROCESO, ya está lista para confirmar.
  // Sin este chequeo, esta pantalla renderizaba igual y el gate solo
  // aparecía recién al enviar (`enviarInspeccion`), con un error de texto
  // sin link de vuelta a lo que falta — a diferencia de `/fotos` y
  // `/estado-conductor`, que sí redirigen así.
  const siguientePaso = await getNextStepPath(id);
  if (siguientePaso !== `/inspecciones/${id}/confirmar`) {
    redirect(siguientePaso);
  }

  const { conductor: firmaConductor } = await getFirmasInspeccion(id);

  // Corrección Slice 2 (hallazgo CRITICAL #5): antes solo miraba
  // `valor === "FALLA"` — un ítem TRIESTADO de fluidos en MALO (que sí crea
  // Novedad, ver esNovedad() en lib/inspections/respuesta.ts) quedaba fuera
  // de "Ítems en falla" y de "Novedades reportadas" justo antes de que el
  // conductor firme. `filtrarNoConformes` reusa el mismo criterio que
  // `responderItem`/`esNovedad`.
  const noConformes = filtrarNoConformes(inspection.respuestas);

  const ahora = new Date();
  const tecnicomecanicaVencida = Boolean(
    inspection.vehicle.fechaVencimientoTecnicomecanica &&
      inspection.vehicle.fechaVencimientoTecnicomecanica < ahora,
  );

  async function confirmarEnvio() {
    "use server";
    try {
      await enviarInspeccion(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo enviar la inspección.";
      redirect(`/inspecciones/${id}/confirmar?error=${encodeURIComponent(message)}`);
    }
    redirect(`/inspecciones/${id}/enviada`);
  }

  async function guardarFirmaAction(formData: FormData) {
    "use server";
    try {
      await guardarFirmaConductor(id, formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la firma.";
      redirect(`/inspecciones/${id}/confirmar?error=${encodeURIComponent(message)}`);
    }
    redirect(`/inspecciones/${id}/confirmar`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-4">
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-lg font-semibold text-[#0B3B60]">Confirmar envío</h1>
      </div>

      <section className="rounded-md border border-gray-200 p-3 text-sm">
        <dl className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <dt className="text-xs text-gray-500">Conductor</dt>
            <dd className="font-medium">{inspection.conductor.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-xs text-gray-500">Conductor activo</dt>
            <dd className={`font-medium ${!inspection.conductor.conductorActivo ? "text-red-600" : ""}`}>
              {inspection.conductor.conductorActivo ? "Sí" : "No"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-xs text-gray-500">Vencimiento tecnicomecánica</dt>
            <dd className={`font-medium ${tecnicomecanicaVencida ? "text-red-600" : ""}`}>
              {formatFecha(inspection.vehicle.fechaVencimientoTecnicomecanica)}
              {tecnicomecanicaVencida && " (vencida)"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1.5">
            <dt className="text-xs text-gray-500">Kilometraje</dt>
            <dd className="font-medium">{inspection.kilometraje} km</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-xs text-gray-500">Ítems en falla</dt>
            <dd className="font-medium">{noConformes.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-xs text-gray-500">Declaración del conductor</dt>
            <dd className="font-medium">{inspection.puedeOperar ? "Sí, está en condiciones" : "No está en condiciones"}</dd>
          </div>
        </dl>
      </section>

      {noConformes.length > 0 && (
        <details className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-900">
          <summary className="cursor-pointer font-medium">
            Novedades reportadas ({noConformes.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {noConformes.map((respuesta) => (
              <div key={respuesta.id}>
                <p className="font-medium">{respuesta.checklistItem.nombre}</p>
                <p>{respuesta.novedad?.descripcion}</p>
                {respuesta.novedad && respuesta.novedad.photos.length > 0 && (
                  <p className="mt-1 text-xs text-red-700">
                    {respuesta.novedad.photos.length} adjunto
                    {respuesta.novedad.photos.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {!inspection.puedeOperar && inspection.justificacionNoOperar && (
        <section className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
          <p className="font-medium">Justificación</p>
          <p>{inspection.justificacionNoOperar}</p>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-md border border-gray-200 p-3">
        <h2 className="mb-2 text-sm font-medium text-gray-500">Nombre y firma del conductor</h2>
        {firmaConductor ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-green-700">✓ Firmado el {formatFechaHora(firmaConductor.createdAt)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto. */}
            <img
              src={firmaConductor.url}
              alt="Firma del conductor"
              className="h-28 w-full max-w-xs rounded-md border border-gray-200 bg-white object-contain"
            />
            <p className="text-sm font-medium text-gray-700">{inspection.conductor.name}</p>
            {inspection.conductor.cedula && (
              <p className="text-xs text-gray-500">C.C. {inspection.conductor.cedula}</p>
            )}
          </div>
        ) : (
          <FirmaCanvas guardarAction={guardarFirmaAction} etiqueta="Dibujá tu firma con el dedo" />
        )}
      </section>

      <form action={confirmarEnvio}>
        <button
          type="submit"
          disabled={!firmaConductor}
          className="w-full rounded-md bg-[#0B3B60] px-4 py-3 text-base font-semibold text-white hover:bg-[#0B3B60]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar inspección
        </button>
        {!firmaConductor && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Firmá arriba para poder enviar la inspección.
          </p>
        )}
      </form>
    </main>
  );
}

function formatFecha(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function formatFechaHora(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(date);
}
