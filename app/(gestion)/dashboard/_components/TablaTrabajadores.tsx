import type { FilaTrabajador, SortTrabajador } from "@/lib/inspections/reportes-queries";
import { SortableHeader } from "./SortableHeader";

/**
 * "Cumplimiento por trabajador" = tasa de aprobación por trabajador (no hay
 * horario en el sistema, así que no hay columnas de "esperadas"/"a
 * tiempo"/"fuera de horario" — ver cabecera de
 * lib/inspections/reportes-queries.ts). Orden vía query params
 * (sortTrabajador/dirTrabajador); búsqueda por nombre vía `qTrabajador`
 * (filtrado server-side en la página, sin JS de cliente).
 */
export function TablaTrabajadores({
  filas,
  sort,
  dir,
  q,
  searchParams,
}: {
  filas: FilaTrabajador[];
  sort: SortTrabajador;
  dir: "asc" | "desc";
  q: string;
  searchParams: Record<string, string | undefined>;
}) {
  const otrosParams = Object.entries(searchParams).filter(([k]) => k !== "qTrabajador");

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-500">Cumplimiento por trabajador</h2>
        <form method="GET" className="flex gap-2">
          {otrosParams.map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input
            type="text"
            name="qTrabajador"
            defaultValue={q}
            placeholder="Buscar trabajador…"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-[#2E9BD6] focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-[#0B3B60] px-3 py-1 text-xs font-medium text-white">
            Buscar
          </button>
        </form>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay trabajadores con inspecciones en el período seleccionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <Th>
                  <SortableHeader label="Trabajador" columnKey="nombre" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Inspecciones" columnKey="total" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Aprobadas" columnKey="aprobadas" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Rechazadas" columnKey="rechazadas" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Novedades" columnKey="novedades" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Tasa de aprobación" columnKey="tasaAprobacion" currentSort={sort} currentDir={dir} sortParam="sortTrabajador" dirParam="dirTrabajador" searchParams={searchParams} />
                </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.workerId} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-2 font-medium text-[#0B3B60]">{f.nombre}</td>
                  <td className="py-2 text-right">{f.total}</td>
                  <td className="py-2 text-right">{f.aprobadas}</td>
                  <td className="py-2 text-right">{f.rechazadas}</td>
                  <td className="py-2 text-right">{f.novedades}</td>
                  <td className="py-2 text-right font-semibold">{f.tasaAprobacion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`py-2 pr-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
