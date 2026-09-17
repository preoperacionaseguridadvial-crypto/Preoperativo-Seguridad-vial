import type { PuntoTendencia } from "@/lib/inspections/reportes-queries";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

function alphaHex(pct: number): string {
  const clamped = Math.min(1, Math.max(0, pct));
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

/**
 * Grid de calendario coloreado por tasa de aprobación diaria (mismo dato de
 * `getTendenciaDiaria`, sin librería de heatmap): días sin inspecciones en
 * gris clarito, el resto en el mismo azul de la paleta con opacidad
 * proporcional a la tasa. `title` nativo hace de tooltip, cero JS.
 */
export function HeatmapCumplimiento({ datos }: { datos: PuntoTendencia[] }) {
  if (datos.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Cumplimiento diario</h2>
        <p className="text-sm text-gray-500">No hay datos en el período seleccionado.</p>
      </section>
    );
  }

  const primerDia = new Date(`${datos[0].fecha}T00:00:00Z`);
  const offset = (primerDia.getUTCDay() + 6) % 7; // 0 = lunes
  const celdas: (PuntoTendencia | null)[] = [...Array(offset).fill(null), ...datos];

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Cumplimiento diario</h2>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <span key={`${d}-${i}`} className="text-center text-[10px] text-gray-400">
            {d}
          </span>
        ))}
        {celdas.map((c, i) =>
          c === null ? (
            <div key={`vacio-${i}`} />
          ) : (
            <div
              key={c.fecha}
              title={`${c.fecha} — ${c.total} inspecciones — ${c.aprobadas} aprobadas — ${c.tasaAprobacion}% tasa de aprobación`}
              className="aspect-square rounded-sm border border-black/5"
              style={{
                backgroundColor:
                  c.total === 0 ? "#F3F4F6" : `#2a78d6${alphaHex(0.15 + (c.tasaAprobacion / 100) * 0.85)}`,
              }}
            />
          ),
        )}
      </div>
      <p className="text-xs text-gray-400">Más oscuro = mayor tasa de aprobación. Gris = sin inspecciones.</p>
    </section>
  );
}
