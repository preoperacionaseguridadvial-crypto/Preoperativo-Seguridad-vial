import type { FallaPorItem } from "@/lib/inspections/reportes-queries";
import { BarraRanking } from "./BarraRanking";

/** "Elementos con mayor número de fallas": qué parte de la moto falla más seguido. */
export function FallasPorItem({ datos }: { datos: FallaPorItem[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Elementos con mayor número de fallas</h2>
      <BarraRanking
        data={datos.map((d) => ({ label: d.nombre, value: d.cantidad }))}
        color="#eb6834"
        emptyMessage="No hay fallas registradas en el período seleccionado."
      />
    </section>
  );
}
