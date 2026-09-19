import type { FilaTrabajador } from "@/lib/inspections/reportes-queries";
import { BarraRanking } from "./BarraRanking";
import { Tarjeta } from "./Tarjeta";

/**
 * "Indicadores destacados": los 5 trabajadores con mejor y con menor tasa de
 * aprobación del período filtrado — independiente del orden que tenga la
 * tabla de trabajadores en ese momento (esta sección calcula su propio
 * orden). Los rankings de vehículos con más novedades y de elementos con más
 * fallas viven ahora en sus propias tarjetas de la parte superior.
 */
export function Top5({ filasTrabajador }: { filasTrabajador: FilaTrabajador[] }) {
  const mejores = [...filasTrabajador].sort((a, b) => b.tasaAprobacion - a.tasaAprobacion).slice(0, 5);
  const peores = [...filasTrabajador].sort((a, b) => a.tasaAprobacion - b.tasaAprobacion).slice(0, 5);

  return (
    <Tarjeta titulo="Indicadores destacados">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Bloque titulo="Mejor tasa de aprobación" data={mejores} color="var(--color-status-ok)" />
        <Bloque titulo="Menor tasa de aprobación" data={peores} color="var(--color-status-crit)" />
      </div>
    </Tarjeta>
  );
}

function Bloque({ titulo, data, color }: { titulo: string; data: FilaTrabajador[]; color: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-ink-muted">{titulo}</h3>
      <BarraRanking
        data={data.map((f) => ({ label: f.nombre, value: f.tasaAprobacion }))}
        color={color}
        emptyMessage="Sin datos en el período seleccionado."
        formatValue={(v) => `${v}%`}
        maximo={100}
      />
    </div>
  );
}
