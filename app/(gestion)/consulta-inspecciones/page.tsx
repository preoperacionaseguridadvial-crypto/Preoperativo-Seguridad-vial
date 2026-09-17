import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getAllInspeccionesForOversight } from "@/lib/inspections/supervisor-queries";
import { InspectionStatus } from "@/generated/prisma/client";

const ESTADOS_FILTRO = [
  InspectionStatus.EN_PROCESO,
  InspectionStatus.ENVIADA,
  InspectionStatus.PENDIENTE_APROBACION,
  InspectionStatus.APROBADA,
  InspectionStatus.RECHAZADA,
  InspectionStatus.NO_APTA_PARA_OPERAR,
  InspectionStatus.CANCELADA,
];

type SearchParams = {
  conductor?: string;
  placa?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
};

// Punto de entrada de la consulta de oversight (DIRECTOR/SST/SUPERVISOR):
// lista de TODAS las inspecciones, cualquier estado, cualquier trabajador,
// con filtros opcionales por conductor/placa/estado/rango de fecha vía query
// params (form GET puro, sin JS). Pantalla de solo lectura — sin ninguna
// acción de mutación (ver [id]/page.tsx para el detalle, también de solo
// lectura).
export default async function ConsultaInspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { conductor, placa, estado, fechaDesde, fechaHasta } = await searchParams;
  const estadoValido =
    estado && (ESTADOS_FILTRO as string[]).includes(estado) ? (estado as InspectionStatus) : undefined;
  const hayFiltrosActivos = Boolean(conductor || placa || estadoValido || fechaDesde || fechaHasta);

  const inspecciones = await getAllInspeccionesForOversight({
    conductor: conductor || undefined,
    placa: placa || undefined,
    estado: estadoValido,
    fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
    fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[#0B3B60]">Todas las inspecciones</h1>
        <Link href="/dashboard" className="text-sm text-[#2E9BD6] hover:underline">
          Ver dashboard →
        </Link>
      </div>

      <form method="GET" className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="conductor" className="mb-1 block text-xs font-medium text-gray-700">
              Conductor
            </label>
            <input
              id="conductor"
              name="conductor"
              type="text"
              defaultValue={conductor ?? ""}
              placeholder="Nombre del conductor"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="placa" className="mb-1 block text-xs font-medium text-gray-700">
              Placa
            </label>
            <input
              id="placa"
              name="placa"
              type="text"
              defaultValue={placa ?? ""}
              placeholder="Placa de la unidad"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="estado" className="mb-1 block text-xs font-medium text-gray-700">
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={estadoValido ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
            >
              <option value="">Todos</option>
              {ESTADOS_FILTRO.map((valor) => (
                <option key={valor} value={valor}>
                  {badgeLabel(valor)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="fechaDesde" className="mb-1 block text-xs font-medium text-gray-700">
                Desde
              </label>
              <input
                id="fechaDesde"
                name="fechaDesde"
                type="date"
                defaultValue={fechaDesde ?? ""}
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="fechaHasta" className="mb-1 block text-xs font-medium text-gray-700">
                Hasta
              </label>
              <input
                id="fechaHasta"
                name="fechaHasta"
                type="date"
                defaultValue={fechaHasta ?? ""}
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#2E9BD6] focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
          >
            Buscar
          </button>
          <Link href="/consulta-inspecciones" className="text-sm text-[#2E9BD6] hover:underline">
            Limpiar filtros
          </Link>
        </div>
      </form>

      {inspecciones.length === 0 && (
        <p className="text-sm text-gray-500">
          {hayFiltrosActivos
            ? "No se encontraron inspecciones con esos filtros."
            : "No hay inspecciones registradas."}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {inspecciones.map((inspection) => (
          <li key={inspection.id}>
            <Link
              href={`/consulta-inspecciones/${inspection.id}`}
              className="block rounded-md border border-gray-200 bg-white px-4 py-3 text-sm hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#0B3B60]">
                  {inspection.vehicle.placa}
                  <span className="ml-2 font-normal text-gray-500">{inspection.worker.name}</span>
                </span>
                <span className={badgeClass(inspection.status)}>{badgeLabel(inspection.status)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                <span>Inicio: {formatFechaHora(inspection.startedAt)}</span>
                <span>Fin: {formatFechaHora(inspection.completedAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function badgeLabel(status: string) {
  switch (status) {
    case "APROBADA":
      return "Aprobada";
    case "RECHAZADA":
      return "Rechazada";
    case "NO_APTA_PARA_OPERAR":
      return "No apta";
    case "PENDIENTE_APROBACION":
      return "Pendiente";
    case "ENVIADA":
      return "Enviada";
    case "EN_PROCESO":
      return "En proceso";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
}

function badgeClass(status: string) {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold";
  switch (status) {
    case "APROBADA":
      return `${base} bg-green-100 text-green-800`;
    case "RECHAZADA":
    case "NO_APTA_PARA_OPERAR":
      return `${base} bg-red-100 text-red-800`;
    case "PENDIENTE_APROBACION":
    case "ENVIADA":
      return `${base} bg-yellow-100 text-yellow-800`;
    default:
      return `${base} bg-gray-100 text-gray-600`;
  }
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
