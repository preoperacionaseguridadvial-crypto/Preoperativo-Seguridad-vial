import Link from "next/link";
import type { PuntoTendencia } from "@/lib/inspections/reportes-queries";
import { buildDashboardUrl } from "./dashboard-url";
import { anchoBarra, formatoDiaMes, indicesEtiquetas, rutaBarra, TICKS_TASA, ticksEje } from "./graficos";
import { Tarjeta } from "./Tarjeta";

const ANCHO = 480;
const ALTO = 220;
const MARGEN = { izq: 32, der: 6, arriba: 10, abajo: 26 };
// Máximo de etiquetas dd/mm en el eje X: con rangos largos (hasta 400 días) se
// adelgazan a intervalos regulares en vez de amontonarse.
const MAX_ETIQUETAS_X = 10;
const ALTO_MIN_BARRA = 1.5;

/**
 * Gráfico de barras SVG a mano (sin librería): una barra por día a partir de
 * los puntos de `getTendenciaDiaria`, con líneas de guía y escala en el eje Y
 * y fechas dd/mm en el X. El toggle cantidad/tasa de aprobación es un link con
 * `?vista=`, no un switch de cliente — el server ya arma las barras de la
 * vista pedida. Cada día es una ranura con tooltip nativo (`<title>`) y un
 * área de hover de alto completo, así los días con barras diminutas también
 * se pueden leer; debajo va la misma información como tabla.
 */
export function TendenciaChart({
  datos,
  vista,
  searchParams,
  className = "",
}: {
  datos: PuntoTendencia[];
  vista: "cantidad" | "tasa";
  searchParams: Record<string, string | undefined>;
  className?: string;
}) {
  const hayInspecciones = datos.some((d) => d.total > 0);
  const subtitulo = vista === "cantidad" ? "Cantidad de inspecciones por día" : "Tasa de aprobación (%) por día";

  const controles = (
    <div className="flex gap-0.5 rounded-lg bg-page p-0.5 text-xs">
      <VistaLink label="Cantidad" activo={vista === "cantidad"} valor="cantidad" searchParams={searchParams} />
      <VistaLink label="Tasa" activo={vista === "tasa"} valor="tasa" searchParams={searchParams} />
    </div>
  );

  if (!hayInspecciones) {
    return (
      <Tarjeta titulo="Tendencia de inspecciones" subtitulo={subtitulo} acciones={controles} className={className}>
        <p className="text-sm text-ink-muted">No hay inspecciones en el período seleccionado.</p>
      </Tarjeta>
    );
  }

  const areaAncho = ANCHO - MARGEN.izq - MARGEN.der;
  const areaAlto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const valorDe = (d: PuntoTendencia) => (vista === "cantidad" ? d.total : d.tasaAprobacion);

  const ticks = vista === "tasa" ? TICKS_TASA : ticksEje(Math.max(...datos.map((d) => d.total)));
  const tope = ticks[ticks.length - 1];
  const yDe = (valor: number) => MARGEN.arriba + areaAlto - (valor / tope) * areaAlto;

  const ranura = areaAncho / datos.length;
  const ancho = anchoBarra(ranura);
  const etiquetasX = new Set(indicesEtiquetas(datos.length, MAX_ETIQUETAS_X));
  const rango = `${formatoDiaMes(datos[0].fecha)} – ${formatoDiaMes(datos[datos.length - 1].fecha)}`;

  return (
    <Tarjeta titulo="Tendencia de inspecciones" subtitulo={`${subtitulo} · ${rango}`} acciones={controles} className={className}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-auto w-full min-w-[360px]"
          role="img"
          aria-label={`Gráfico de barras: ${subtitulo.toLowerCase()}, del ${rango}. Los mismos datos están en la tabla de abajo.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.izq}
                x2={ANCHO - MARGEN.der}
                y1={yDe(t)}
                y2={yDe(t)}
                strokeWidth={1}
                className={t === 0 ? "stroke-viz-axis" : "stroke-viz-grid"}
              />
              <text x={MARGEN.izq - 6} y={yDe(t) + 3.5} textAnchor="end" className="fill-ink-muted text-[10px]">
                {vista === "tasa" ? `${t}%` : t}
              </text>
            </g>
          ))}

          {datos.map((d, i) => {
            const x0 = MARGEN.izq + i * ranura;
            const valor = valorDe(d);
            // En la vista de tasa un día sin inspecciones no tiene tasa: sin barra, no una barra en 0%.
            const conBarra = valor > 0 && d.total > 0;
            const alto = conBarra ? Math.max((valor / tope) * areaAlto, ALTO_MIN_BARRA) : 0;
            const ruta = rutaBarra({ x: x0 + (ranura - ancho) / 2, y: MARGEN.arriba + areaAlto - alto, ancho, alto });
            return (
              <g key={d.fecha}>
                <title>
                  {d.total === 0
                    ? `${d.fecha} — sin inspecciones`
                    : `${d.fecha} — ${d.total} inspecciones — ${d.aprobadas} aprobadas — ${d.tasaAprobacion}% tasa de aprobación`}
                </title>
                <rect x={x0} y={MARGEN.arriba} width={ranura} height={areaAlto} fill="transparent" />
                {ruta && <path d={ruta} className="fill-viz-blue" />}
                {etiquetasX.has(i) && (
                  <text
                    x={x0 + ranura / 2}
                    y={ALTO - MARGEN.abajo + 16}
                    textAnchor="middle"
                    className="fill-ink-muted text-[10px]"
                  >
                    {formatoDiaMes(d.fecha)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-status-info-ink">Ver datos en tabla</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface text-ink-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">Fecha</th>
                <th className="py-1 pr-2 text-right font-medium">Inspecciones</th>
                <th className="py-1 pr-2 text-right font-medium">Aprobadas</th>
                <th className="py-1 text-right font-medium">Tasa</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {datos.map((d) => (
                <tr key={d.fecha} className="border-t border-border">
                  <td className="py-1 pr-2">{d.fecha}</td>
                  <td className="py-1 pr-2 text-right">{d.total}</td>
                  <td className="py-1 pr-2 text-right">{d.aprobadas}</td>
                  <td className="py-1 text-right">{d.total === 0 ? "—" : `${d.tasaAprobacion}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Tarjeta>
  );
}

function VistaLink({
  label,
  activo,
  valor,
  searchParams,
}: {
  label: string;
  activo: boolean;
  valor: string;
  searchParams: Record<string, string | undefined>;
}) {
  return (
    <Link
      href={buildDashboardUrl("/dashboard", searchParams, { vista: valor })}
      aria-current={activo ? "true" : undefined}
      className={`rounded-md px-2.5 py-1 ${activo ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}
