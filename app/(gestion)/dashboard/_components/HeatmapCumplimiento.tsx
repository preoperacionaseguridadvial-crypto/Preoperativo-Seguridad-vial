import type { PuntoTendencia } from "@/lib/inspections/reportes-queries";
import { construirGrillaSemanal, formatoDiaMes, opacidadCelda } from "./graficos";
import { Tarjeta } from "./Tarjeta";

// Lunes primero (el resto del sistema es es-CO). Los nombres completos van en
// `title` porque la inicial sola es ambigua (M = martes/miércoles, ...).
const DIAS_SEMANA = [
  { inicial: "L", nombre: "Lunes" },
  { inicial: "M", nombre: "Martes" },
  { inicial: "M", nombre: "Miércoles" },
  { inicial: "J", nombre: "Jueves" },
  { inicial: "V", nombre: "Viernes" },
  { inicial: "S", nombre: "Sábado" },
  { inicial: "D", nombre: "Domingo" },
];

// Semanas visibles sin scroll; rangos más largos (hasta 400 días) scrollean dentro de la tarjeta.
const SEMANAS_SIN_SCROLL = 8;

// Verde de estado "bueno" (el color codifica tasa de aprobación: más
// oscuro = más aprobadas) — mismo rgb que `--color-status-ok` (#0ca30c).
const RGB_TASA = "12 163 12";

/**
 * Calendario de cumplimiento diario: grilla lunes-primero, una celda por día,
 * coloreada por la TASA DE APROBACIÓN del día (aprobadas / inspecciones ese
 * día — el mismo dato de `getTendenciaDiaria`, no volumen de inspecciones).
 * Días sin inspecciones en gris. Cada celda lleva `title` nativo (tooltip) y
 * `aria-label`, así el valor nunca depende solo del color; los mismos datos
 * están en la tabla de "Tendencia de inspecciones".
 */
export function HeatmapCumplimiento({ datos, className = "" }: { datos: PuntoTendencia[]; className?: string }) {
  if (datos.length === 0) {
    return (
      <Tarjeta titulo="Cumplimiento diario" className={className}>
        <p className="text-sm text-ink-muted">No hay datos en el período seleccionado.</p>
      </Tarjeta>
    );
  }

  const semanas = construirGrillaSemanal(datos);

  return (
    <Tarjeta titulo="Cumplimiento diario" subtitulo="Color = tasa de aprobación del día" className={className}>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {/* Encabezado y celdas en una sola grilla (encabezado pegajoso) para que las columnas queden alineadas aun con scroll. */}
          <div className={`grid grid-cols-7 gap-1 ${semanas.length > SEMANAS_SIN_SCROLL ? "max-h-52 overflow-y-auto" : ""}`}>
            {DIAS_SEMANA.map((d) => (
              <span
                key={d.nombre}
                aria-hidden="true"
                title={d.nombre}
                className="sticky top-0 bg-surface pb-0.5 text-center text-[10px] font-medium text-ink-muted"
              >
                {d.inicial}
              </span>
            ))}
            {semanas.flat().map((c, i) =>
              c === null ? (
                <div key={`vacio-${i}`} />
              ) : (
                <div
                  key={c.fecha}
                  role="img"
                  aria-label={
                    c.total === 0
                      ? `${formatoDiaMes(c.fecha)}: sin inspecciones`
                      : `${formatoDiaMes(c.fecha)}: ${c.total} inspecciones, ${c.tasaAprobacion}% tasa de aprobación`
                  }
                  title={`${c.fecha} — ${c.total} inspecciones — ${c.aprobadas} aprobadas — ${c.tasaAprobacion}% tasa de aprobación`}
                  className={`h-5 rounded-[4px] ${c.total === 0 ? "bg-viz-track" : ""}`}
                  style={c.total === 0 ? undefined : { backgroundColor: `rgb(${RGB_TASA} / ${opacidadCelda(c.tasaAprobacion)})` }}
                />
              ),
            )}
          </div>
        </div>

        <ul className="flex w-28 shrink-0 flex-col justify-center gap-3 text-xs text-ink-muted">
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-[3px] bg-status-ok" />
            Mayor tasa de aprobación
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: `rgb(${RGB_TASA} / ${opacidadCelda(0)})` }}
            />
            Menor tasa de aprobación
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-[3px] bg-viz-track" />
            Sin inspecciones
          </li>
        </ul>
      </div>
    </Tarjeta>
  );
}
