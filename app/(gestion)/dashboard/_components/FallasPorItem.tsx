import type { FallaPorItem } from "@/lib/inspections/reportes-queries";
import { BarraRanking, colorPorSeveridad } from "./BarraRanking";
import { Tarjeta } from "./Tarjeta";

const TOP = 5;

/** "Elementos con más fallas": qué parte del vehículo falla más seguido (top 5). */
export function FallasPorItem({ datos, className = "" }: { datos: FallaPorItem[]; className?: string }) {
  return (
    <Tarjeta titulo="Elementos con más fallas" className={className}>
      <BarraRanking
        data={datos.slice(0, TOP).map((d) => ({ label: d.nombre, value: d.cantidad }))}
        color={colorPorSeveridad}
        emptyMessage="No hay fallas registradas en el período seleccionado."
      />
    </Tarjeta>
  );
}
