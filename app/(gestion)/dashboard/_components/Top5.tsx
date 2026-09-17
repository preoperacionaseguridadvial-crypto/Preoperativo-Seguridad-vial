import type { FallaPorItem, FilaTrabajador, FilaVehiculo } from "@/lib/inspections/reportes-queries";
import { BarraRanking } from "./BarraRanking";

/**
 * "Indicadores destacados": top 5 dinámico según el período filtrado —
 * independiente del orden que tenga la tabla de trabajadores/vehículos en
 * ese momento (esta sección calcula su propio orden mejor/peor).
 */
export function Top5({
  filasTrabajador,
  filasVehiculo,
  fallasPorItem,
}: {
  filasTrabajador: FilaTrabajador[];
  filasVehiculo: FilaVehiculo[];
  fallasPorItem: FallaPorItem[];
}) {
  const mejores = [...filasTrabajador].sort((a, b) => b.tasaAprobacion - a.tasaAprobacion).slice(0, 5);
  const peores = [...filasTrabajador].sort((a, b) => a.tasaAprobacion - b.tasaAprobacion).slice(0, 5);
  const vehiculosTop = [...filasVehiculo].sort((a, b) => b.novedades - a.novedades).slice(0, 5);
  const fallasTop = fallasPorItem.slice(0, 5);

  return (
    <section className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Indicadores destacados</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Bloque
          titulo="Mejor tasa de aprobación"
          data={mejores.map((f) => ({ label: f.nombre, value: f.tasaAprobacion }))}
          color="#0ca30c"
          sufijo="%"
        />
        <Bloque
          titulo="Menor tasa de aprobación"
          data={peores.map((f) => ({ label: f.nombre, value: f.tasaAprobacion }))}
          color="#d03b3b"
          sufijo="%"
        />
        <Bloque
          titulo="Vehículos con más novedades"
          data={vehiculosTop.map((v) => ({ label: v.placa, value: v.novedades }))}
          color="#eb6834"
        />
        <Bloque
          titulo="Elementos con más fallas"
          data={fallasTop.map((f) => ({ label: f.nombre, value: f.cantidad }))}
          color="#4a3aa7"
        />
      </div>
    </section>
  );
}

function Bloque({
  titulo,
  data,
  color,
  sufijo,
}: {
  titulo: string;
  data: { label: string; value: number }[];
  color: string;
  sufijo?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{titulo}</h3>
      <BarraRanking
        data={data}
        color={color}
        emptyMessage="Sin datos en el período seleccionado."
        formatValue={sufijo ? (v) => `${v}${sufijo}` : undefined}
      />
    </div>
  );
}
