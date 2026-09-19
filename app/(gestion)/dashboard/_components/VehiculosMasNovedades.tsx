import type { FilaVehiculo } from "@/lib/inspections/reportes-queries";
import { BarraRanking, colorPorSeveridad } from "./BarraRanking";
import { Tarjeta } from "./Tarjeta";

const TOP = 5;

/**
 * "Vehículos con más novedades": top 5 por novedades del período, con su
 * propio orden — independiente del orden que tenga la tabla de vehículos en
 * ese momento. Solo entran vehículos con al menos una novedad.
 */
export function VehiculosMasNovedades({ filas, className = "" }: { filas: FilaVehiculo[]; className?: string }) {
  const top = filas
    .filter((v) => v.novedades > 0)
    .sort((a, b) => b.novedades - a.novedades)
    .slice(0, TOP);

  return (
    <Tarjeta titulo="Vehículos con más novedades" className={className}>
      <BarraRanking
        data={top.map((v) => ({ label: v.placa, value: v.novedades }))}
        color={colorPorSeveridad}
        emptyMessage="No hay novedades en el período seleccionado."
      />
    </Tarjeta>
  );
}
