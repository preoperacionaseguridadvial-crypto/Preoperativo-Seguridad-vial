import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getInspeccionDetalleForOversight } from "@/lib/inspections/supervisor-queries";
import { getFirmasInspeccion } from "@/lib/inspections/queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { AdjuntoNovedad } from "@/app/_components/AdjuntoNovedad";

// Pantalla de detalle de la consulta de oversight (DIRECTOR/SST): toda la
// información que el trabajador cargó (medidas, checklist agrupado por
// categoría, novedades con fotos, resultado final) y, si ya fue decidida
// por el Supervisor, la decisión y la evidencia de ambas firmas. A
// diferencia de app/(supervisor)/aprobaciones/[id]/page.tsx, esta pantalla
// es SIEMPRE de solo lectura: no renderiza ningún formulario ni acción de
// mutación, ni siquiera cuando la inspección sigue pendiente de decisión.
export default async function ConsultaInspeccionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getInspeccionDetalleForOversight(id);
  const decidida = inspection.reviewedAt !== null;
  const { conductor: firmaConductor, supervisor: firmaSupervisor } = await getFirmasInspeccion(id);

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

  const ahora = new Date();
  const paseVencido = Boolean(
    inspection.conductor.fechaVencimientoPase && inspection.conductor.fechaVencimientoPase < ahora,
  );
  const tecnicomecanicaVencida = Boolean(
    inspection.vehicle.fechaVencimientoTecnicomecanica &&
      inspection.vehicle.fechaVencimientoTecnicomecanica < ahora,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/consulta-inspecciones" className="text-sm text-[#2E9BD6] hover:underline">
            ← Volver a todas las inspecciones
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">
            {inspection.vehicle.placa}
            <span className="ml-2 text-base font-normal text-gray-500">{inspection.vehicle.tipo}</span>
          </h1>
        </div>
        {session.user.role === "SST" &&
          inspection.status !== "EN_PROCESO" &&
          inspection.status !== "CANCELADA" && (
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
            <dt className="text-gray-500">Vencimiento pase</dt>
            <dd className={`font-medium ${paseVencido ? "text-red-600" : ""}`}>
              {formatFecha(inspection.conductor.fechaVencimientoPase)}
              {paseVencido && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  Vencido
                </span>
              )}
            </dd>
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

      <section className="flex flex-col gap-4 border-t border-gray-200 pt-6">
        <h2 className="text-sm font-medium text-gray-500">Decisión</h2>
        {decidida ? (
          <>
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
          </>
        ) : (
          <p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
            Pendiente de decisión del supervisor.
          </p>
        )}
      </section>
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

// Corrección Slice 3 (paridad con app/(supervisor)/aprobaciones/[id]/page.tsx,
// commit 29cf775): antes solo distinguía OK/Falla — los ítems de fluidos con
// `tipoRespuesta = TRIESTADO` (Slice 2, BUENO/BAJO/MALO) caían todos en
// "Falla" salvo OK, mostrando "Bueno" y "Bajo" como si fueran fallas reales.
// "Bajo" es advertencia, no falla (no crea Novedad, ver
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
