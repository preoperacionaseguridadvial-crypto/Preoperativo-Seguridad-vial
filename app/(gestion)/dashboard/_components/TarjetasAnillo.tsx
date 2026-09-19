import type { KpisConComparacion } from "@/lib/inspections/reportes-queries";
import { geometriaAnillo, formatoPorcentaje, porcentaje } from "./metricas";
import { Tarjeta } from "./Tarjeta";
import { VariacionDelta } from "./VariacionDelta";

type Tono = "info" | "ok" | "crit" | "warn";

// Clases completas (no armadas por concatenación) para que Tailwind las detecte.
const CLASES_ANILLO: Record<Tono, { arco: string; pista: string }> = {
  info: { arco: "stroke-viz-blue", pista: "stroke-status-info-soft" },
  ok: { arco: "stroke-status-ok", pista: "stroke-status-ok-soft" },
  crit: { arco: "stroke-status-crit", pista: "stroke-status-crit-soft" },
  warn: { arco: "stroke-status-warn", pista: "stroke-status-warn-soft" },
};

const RADIO = 42;
const GROSOR = 11;

/**
 * Las cuatro tarjetas con anillo del dashboard (Inspecciones realizadas,
 * Aprobadas, Rechazadas, Pendientes de aprobación). Devuelve las tarjetas
 * sueltas para que la página las ubique en su grilla junto a "Acciones
 * rápidas". "Pendientes" no tiene valor `anterior` en los KPIs, así que no
 * muestra variación (no se inventa una).
 */
export function TarjetasAnillo({ kpis }: { kpis: KpisConComparacion }) {
  const { total, aprobadas, rechazadas, pendientesAprobacion, anterior } = kpis;
  const delTotal = (parte: number) => `${formatoPorcentaje(porcentaje(parte, total))} del total`;

  return (
    <>
      <TarjetaAnillo
        titulo="Inspecciones realizadas"
        valor={total}
        fraccion={total > 0 ? 1 : 0}
        tono="info"
        leyenda="Total del período"
        etiquetaAnillo={`Inspecciones realizadas: ${total}`}
        delta={<VariacionDelta actual={total} anterior={anterior.total} />}
      />
      <TarjetaAnillo
        titulo="Aprobadas"
        valor={aprobadas}
        fraccion={total > 0 ? aprobadas / total : 0}
        tono="ok"
        leyenda={delTotal(aprobadas)}
        etiquetaAnillo={`Aprobadas: ${aprobadas} de ${total}`}
        delta={<VariacionDelta actual={aprobadas} anterior={anterior.aprobadas} />}
      />
      <TarjetaAnillo
        titulo="Rechazadas"
        valor={rechazadas}
        fraccion={total > 0 ? rechazadas / total : 0}
        tono="crit"
        leyenda={delTotal(rechazadas)}
        etiquetaAnillo={`Rechazadas: ${rechazadas} de ${total}`}
        delta={<VariacionDelta actual={rechazadas} anterior={anterior.rechazadas} invertido />}
      />
      <TarjetaAnillo
        titulo="Pendientes de aprobación"
        valor={pendientesAprobacion}
        fraccion={total > 0 ? pendientesAprobacion / total : 0}
        tono="warn"
        leyenda={delTotal(pendientesAprobacion)}
        etiquetaAnillo={`Pendientes de aprobación: ${pendientesAprobacion} de ${total}`}
      />
    </>
  );
}

function TarjetaAnillo({
  titulo,
  valor,
  fraccion,
  tono,
  leyenda,
  etiquetaAnillo,
  delta,
}: {
  titulo: string;
  valor: number;
  fraccion: number;
  tono: Tono;
  leyenda: string;
  etiquetaAnillo: string;
  delta?: React.ReactNode;
}) {
  const { arco, resto } = geometriaAnillo(fraccion, RADIO);
  const clases = CLASES_ANILLO[tono];

  return (
    <Tarjeta fila>
      <div role="img" aria-label={etiquetaAnillo} className="relative size-24 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx={50} cy={50} r={RADIO} fill="none" strokeWidth={GROSOR} className={clases.pista} />
          {arco > 0 && (
            <circle
              cx={50}
              cy={50}
              r={RADIO}
              fill="none"
              strokeWidth={GROSOR}
              strokeDasharray={`${arco} ${resto}`}
              className={clases.arco}
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-ink">{valor}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-sm font-semibold leading-snug text-ink">{titulo}</h2>
        <p className="text-xs text-ink-muted">{leyenda}</p>
        {delta}
      </div>
    </Tarjeta>
  );
}
