import Link from "next/link";
import type { PuntoTendencia } from "@/lib/inspections/reportes-queries";
import { buildDashboardUrl } from "./dashboard-url";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = 24;

/**
 * Gráfico de línea SVG a mano (sin librería): un `<path>` calculado a partir
 * de los puntos de `getTendenciaDiaria`. El toggle cantidad/tasa de
 * aprobación es un link con `?vista=`, no un switch de cliente — el server
 * ya arma el path correcto para la vista pedida.
 */
export function TendenciaChart({
  datos,
  vista,
  searchParams,
}: {
  datos: PuntoTendencia[];
  vista: "cantidad" | "tasa";
  searchParams: Record<string, string | undefined>;
}) {
  const valores = datos.map((d) => (vista === "cantidad" ? d.total : d.tasaAprobacion));
  const max = Math.max(1, ...valores);
  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;

  const puntos = datos.map((d, i) => {
    const x = datos.length <= 1 ? PADDING : PADDING + (i / (datos.length - 1)) * innerWidth;
    const valor = vista === "cantidad" ? d.total : d.tasaAprobacion;
    const y = PADDING + innerHeight - (valor / max) * innerHeight;
    return { x, y, d };
  });

  const path = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-500">Cumplimiento de inspecciones</h2>
        <div className="flex gap-1 text-xs">
          <VistaLink label="Cantidad" activo={vista === "cantidad"} valor="cantidad" searchParams={searchParams} />
          <VistaLink label="Tasa de aprobación" activo={vista === "tasa"} valor="tasa" searchParams={searchParams} />
        </div>
      </div>

      {datos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Tendencia de inspecciones">
          <line
            x1={PADDING}
            y1={HEIGHT - PADDING}
            x2={WIDTH - PADDING}
            y2={HEIGHT - PADDING}
            stroke="#e1e0d9"
            strokeWidth={1}
          />
          <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {puntos.map((p) => (
            <circle key={p.d.fecha} cx={p.x} cy={p.y} r={3} fill="#2a78d6">
              <title>
                {`${p.d.fecha} — ${p.d.total} inspecciones — ${p.d.aprobadas} aprobadas — ${p.d.tasaAprobacion}% tasa de aprobación`}
              </title>
            </circle>
          ))}
        </svg>
      )}
      <p className="text-xs text-gray-400">
        {vista === "cantidad" ? "Cantidad de inspecciones por día." : "Tasa de aprobación (%) por día."}
      </p>
    </section>
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
      className={`rounded-md px-2 py-1 ${activo ? "bg-[#0B3B60] text-white" : "text-gray-500 hover:bg-gray-100"}`}
    >
      {label}
    </Link>
  );
}
