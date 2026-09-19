import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getInspeccionDetalleOrNotFound } from "@/lib/inspections/supervisor-queries";
import { aprobarInspeccion, rechazarInspeccion } from "@/lib/inspections/supervisor-actions";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { AdjuntoNovedad } from "@/app/_components/AdjuntoNovedad";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";

// Pantalla de detalle de la revisión del Supervisor (Fase 3): toda la
// información que el trabajador cargó (medidas, checklist agrupado por
// categoría igual que lo vivió, novedades con fotos, resultado final) y,
// al final, el formulario de decisión (Aprobar/Rechazar) — la firma del
// supervisor ya NO es requisito previo para decidir, es un paso posterior
// (ver app/(supervisor)/aprobaciones/[id]/firma/page.tsx): apenas decide,
// esta misma página lo redirige ahí si todavía no firmó. También es la
// única pantalla del proyecto que muestra el detalle de una inspección ya
// decidida (no existía otra) — en ese caso queda en modo lectura, con la
// decisión tomada y la evidencia de ambas firmas.
export default async function AprobacionDetallePage({
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

  const inspection = await getInspeccionDetalleOrNotFound(id);
  const decidida = inspection.reviewedAt !== null;
  const { conductor: firmaConductor, supervisor: firmaSupervisor } = await getFirmasInspeccion(id);

  // Ya decidió pero todavía no firmó: lo mandamos a completar la firma antes
  // de mostrarle este detalle. Si es OTRO supervisor mirando una decisión
  // ajena sin firmar, no lo redirigimos — se queda viendo el detalle de
  // solo lectura con la caja de firma del supervisor vacía.
  if (decidida && !firmaSupervisor && inspection.supervisorId === session.user.id) {
    redirect(`/aprobaciones/${id}/firma`);
  }

  const categorias = new Map<
    string,
    { orden: number; items: typeof inspection.respuestas }
  >();
  for (const respuesta of inspection.respuestas) {
    const categoria = respuesta.checklistItem.category;
    const entry = categorias.get(categoria.id) ?? { orden: categoria.orden, items: [] };
    entry.items.push(respuesta);
    categorias.set(categoria.id, entry);
  }
  const categoriasOrdenadas = [...categorias.entries()]
    .map(([id, value]) => ({ id, nombre: value.items[0].checklistItem.category.nombre, ...value }))
    .sort((a, b) => a.orden - b.orden);
  for (const categoria of categoriasOrdenadas) {
    categoria.items.sort((a, b) => a.checklistItem.orden - b.checklistItem.orden);
  }

  const noApta = inspection.status === "NO_APTA_PARA_OPERAR";
  // Slice 3 (A6/D8): dato derivado, nunca bloquea ni auto-transiciona —
  // solo decide si esta pantalla muestra la advertencia.
  const alertaEstadoConductor = requiereAtencionEstadoConductor(inspection);

  const ahora = new Date();
  const tecnicomecanicaVencida = Boolean(
    inspection.vehicle.fechaVencimientoTecnicomecanica &&
      inspection.vehicle.fechaVencimientoTecnicomecanica < ahora,
  );

  async function aprobarAction(formData: FormData) {
    "use server";
    const observacion = formData.get("observacion")?.toString();
    try {
      await aprobarInspeccion(id, observacion);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo aprobar la inspección.";
      redirect(`/aprobaciones/${id}?error=${encodeURIComponent(message)}`);
    }
    // Volvemos al detalle (no a la lista): esta misma página es la que
    // redirige a /firma cuando la decisión es propia y todavía no tiene
    // firma — si redirigiéramos directo a /aprobaciones, ese paso se salta.
    redirect(`/aprobaciones/${id}`);
  }

  async function rechazarAction(formData: FormData) {
    "use server";
    const observacion = formData.get("observacion")?.toString() ?? "";
    try {
      await rechazarInspeccion(id, observacion);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo rechazar la inspección.";
      redirect(`/aprobaciones/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect(`/aprobaciones/${id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/aprobaciones" className="text-sm text-[#2E9BD6] hover:underline">
            ← Volver a pendientes
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">
            {inspection.vehicle.placa}
            <span className="ml-2 text-base font-normal text-gray-500">{inspection.vehicle.tipo}</span>
          </h1>
        </div>
        {session.user.role === "SST" && (
          <a
            href={`/api/inspecciones/${id}/pdf`}
            className="shrink-0 rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Descargar PDF
          </a>
        )}
      </div>

      <section className="rounded-md border border-gray-200 p-4 text-sm">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-gray-500">Trabajador</dt>
            <dd className="font-medium">{inspection.worker.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Conductor</dt>
            <dd className="font-medium">{inspection.conductor.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Conductor activo</dt>
            <dd className={`font-medium ${!inspection.conductor.conductorActivo ? "text-red-600" : ""}`}>
              {inspection.conductor.conductorActivo ? (
                "Sí"
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  Inactivo
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Vencimiento tecnicomecánica</dt>
            <dd className={`font-medium ${tecnicomecanicaVencida ? "text-red-600" : ""}`}>
              {formatFecha(inspection.vehicle.fechaVencimientoTecnicomecanica)}
              {tecnicomecanicaVencida && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  Vencida
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Inicio</dt>
            <dd className="font-medium">{formatFechaHora(inspection.startedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Fin</dt>
            <dd className="font-medium">{formatFechaHora(inspection.completedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Kilometraje</dt>
            <dd className="font-medium">{inspection.kilometraje ?? "—"} km</dd>
          </div>
        </dl>
      </section>

      <section
        className={`rounded-md p-4 text-sm ${
          noApta ? "bg-red-50 text-red-900" : "bg-green-50 text-green-900"
        }`}
      >
        <p className="text-xs uppercase tracking-wide opacity-70">Resultado reportado</p>
        <p className="text-lg font-semibold">
          {inspection.puedeOperar ? "✓ Puede operar" : "✕ No puede operar"}
        </p>
        {!inspection.puedeOperar && inspection.justificacionNoOperar && (
          <p className="mt-1">{inspection.justificacionNoOperar}</p>
        )}
      </section>

      <section
        className={`rounded-md p-4 text-sm ${
          alertaEstadoConductor ? "bg-amber-50 text-amber-900" : "border border-gray-200"
        }`}
      >
        <p className="text-xs uppercase tracking-wide opacity-70">Declaración del conductor</p>
        {alertaEstadoConductor && (
          <p className="text-base font-semibold">⚠ Requiere atención</p>
        )}
        <dl className="mt-2 flex flex-col gap-1">
          <div className="flex justify-between">
            <dt>¿Medicamento/sustancia/condición que afecte su capacidad?</dt>
            <dd className="font-medium">{siNoOTexto(inspection.tomaMedicamentos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>¿Condiciones físicas y mentales adecuadas?</dt>
            <dd className="font-medium">{siNoOTexto(inspection.condicionesAptas)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>¿Consumió alcohol u otra sustancia?</dt>
            <dd className="font-medium">{siNoOTexto(inspection.consumioAlcohol)}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-gray-500">Checklist</h2>
        {categoriasOrdenadas.map((categoria) => (
          <div key={categoria.id} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase text-gray-400">{categoria.nombre}</h3>
            <ul className="flex flex-col gap-1.5">
              {categoria.items.map((respuesta) => (
                <li
                  key={respuesta.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <span>{respuesta.checklistItem.nombre}</span>
                  <span className={badgeClass(respuesta.valor)}>{badgeLabel(respuesta.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {inspection.novedades.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">Novedades reportadas</h2>
          {inspection.novedades.map((novedad) => (
            <div key={novedad.id} className="rounded-md bg-red-50 p-3 text-sm text-red-900">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {novedad.inspectionItemResponse?.checklistItem.nombre ?? "Novedad general"}
                </p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  {TIPO_NOVEDAD_LABELS[novedad.tipo]}
                </span>
              </div>
              <p className="mt-1">{novedad.descripcion}</p>
              {novedad.ubicacion && (
                <p className="mt-1 text-xs text-red-800">
                  <span className="font-semibold">¿Dónde? </span>
                  {novedad.ubicacion}
                </p>
              )}
              {novedad.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {novedad.photos.map((photo) => (
                    <AdjuntoNovedad key={photo.id} url={photo.url} alt="Adjunto de la novedad" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {decidida ? (
        <section className="flex flex-col gap-4 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-medium text-gray-500">Decisión</h2>
          <div
            className={`rounded-md p-3 text-sm ${
              inspection.status === "APROBADA" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
            }`}
          >
            <p className="font-semibold">
              {inspection.status === "APROBADA" ? "✓ Aprobada" : "✕ Rechazada"} el{" "}
              {formatFechaHora(inspection.reviewedAt)}
            </p>
            {inspection.observacionesSupervisor && <p className="mt-1">{inspection.observacionesSupervisor}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FirmaEvidencia
              etiqueta="Conductor"
              firma={firmaConductor}
              nombre={inspection.conductor.name}
              cedula={inspection.conductor.cedula}
            />
            <FirmaEvidencia
              etiqueta="Supervisor"
              firma={firmaSupervisor}
              nombre={inspection.supervisor?.name ?? null}
              cedula={inspection.supervisor?.cedula ?? null}
            />
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-medium text-gray-500">Decisión</h2>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <form action={aprobarAction} className="flex flex-col gap-3">
            <div>
              <label htmlFor="observacion-aprobar" className="mb-1 block text-sm font-medium text-gray-700">
                Observaciones (opcional)
              </label>
              <textarea
                id="observacion-aprobar"
                name="observacion"
                rows={3}
                placeholder="Comentarios adicionales para el trabajador."
                className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-green-600 px-4 py-4 text-base font-semibold text-white hover:bg-green-700"
            >
              ✓ Aprobar
            </button>
          </form>

          <form action={rechazarAction} className="flex flex-col gap-3">
            <div>
              <label htmlFor="observacion-rechazar" className="mb-1 block text-sm font-medium text-gray-700">
                Observaciones (obligatorio para rechazar)
              </label>
              <textarea
                id="observacion-rechazar"
                name="observacion"
                required
                minLength={3}
                rows={3}
                placeholder="Explicá por qué se rechaza esta inspección."
                className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#2E9BD6] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-red-600 px-4 py-4 text-base font-semibold text-white hover:bg-red-700"
            >
              ✕ Rechazar
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function FirmaEvidencia({
  etiqueta,
  firma,
  nombre,
  cedula,
}: {
  etiqueta: string;
  firma: { url: string; createdAt: Date } | null;
  nombre?: string | null;
  cedula?: string | null;
}) {
  if (!firma) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-gray-300 p-3 text-center">
        <p className="text-xs text-gray-500">{etiqueta}</p>
        <p className="text-xs text-gray-400">Sin firma</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs text-gray-500">
        {etiqueta} — {formatFechaHora(firma.createdAt)}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto. */}
      <img
        src={firma.url}
        alt={`Firma del ${etiqueta.toLowerCase()}`}
        className="h-24 w-full max-w-xs rounded-md border border-gray-200 bg-white object-contain"
      />
      {nombre && <p className="text-sm font-medium text-gray-700">{nombre}</p>}
      {cedula && <p className="text-xs text-gray-500">C.C. {cedula}</p>}
    </div>
  );
}

function formatFechaHora(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatFecha(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

// Corrección Slice 3: antes solo distinguía OK/Falla — los ítems de
// fluidos con `tipoRespuesta = TRIESTADO` (Slice 2, BUENO/BAJO/MALO) caían
// todos en "Falla" salvo OK, mostrando "Bueno" y "Bajo" como si fueran
// fallas reales. "Bajo" es advertencia, no falla (no crea Novedad, ver
// lib/inspections/respuesta.ts `esNovedad`) — color propio (ámbar) para no
// confundirlo con "Malo".
function badgeLabel(valor: string) {
  switch (valor) {
    case "OK":
      return "OK";
    case "BUENO":
      return "Bueno";
    case "BAJO":
      return "Bajo";
    case "MALO":
      return "Malo";
    default:
      return "Falla";
  }
}

function badgeClass(valor: string) {
  const base = "rounded-full px-2 py-0.5 text-xs font-semibold";
  if (valor === "OK" || valor === "BUENO") return `${base} bg-green-100 text-green-800`;
  if (valor === "BAJO") return `${base} bg-amber-100 text-amber-800`;
  return `${base} bg-red-100 text-red-800`; // FALLA, MALO
}

function siNoOTexto(valor: boolean | null) {
  if (valor === null) return "—";
  return valor ? "Sí" : "No";
}
