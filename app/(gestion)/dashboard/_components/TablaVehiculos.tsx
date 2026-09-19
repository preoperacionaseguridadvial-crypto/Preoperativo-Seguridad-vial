import type { FilaVehiculo, SortVehiculo } from "@/lib/inspections/reportes-queries";
import { SortableHeader } from "./SortableHeader";
import { Tarjeta } from "./Tarjeta";

/** "Estado de vehículos": permite identificar rápido cuáles motos acumulan más novedades. */
export function TablaVehiculos({
  filas,
  sort,
  dir,
  searchParams,
}: {
  filas: FilaVehiculo[];
  sort: SortVehiculo;
  dir: "asc" | "desc";
  searchParams: Record<string, string | undefined>;
}) {
  return (
    <Tarjeta>
      <h2 className="text-sm font-semibold text-ink">Estado de vehículos</h2>

      {filas.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay vehículos con inspecciones en el período seleccionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <Th>
                  <SortableHeader label="Placa" columnKey="placa" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Inspecciones" columnKey="total" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Aprobadas" columnKey="aprobadas" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Rechazadas" columnKey="rechazadas" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Novedades" columnKey="novedades" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
                <Th align="right">
                  <SortableHeader label="Última inspección" columnKey="ultimaInspeccion" currentSort={sort} currentDir={dir} sortParam="sortVehiculo" dirParam="dirVehiculo" searchParams={searchParams} />
                </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.vehicleId} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-2 font-medium text-ink">{f.placa}</td>
                  <td className="py-2 text-right">{f.total}</td>
                  <td className="py-2 text-right">{f.aprobadas}</td>
                  <td className="py-2 text-right">{f.rechazadas}</td>
                  <td className="py-2 text-right">{f.novedades}</td>
                  <td className="py-2 text-right">
                    {new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(f.ultimaInspeccion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`py-2 pr-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
