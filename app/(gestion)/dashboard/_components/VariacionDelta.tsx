import { tonoVariacion, variacion, type DireccionVariacion, type TonoVariacion } from "./metricas";
import { Icono } from "./Iconos";

const COLOR_POR_TONO: Record<TonoVariacion, string> = {
  bueno: "text-status-ok-ink",
  malo: "text-status-crit-ink",
  neutro: "text-ink-muted",
};

const ICONO_POR_DIRECCION = { sube: "arriba", baja: "abajo", igual: "igual" } as const;
const TEXTO_SR: Record<DireccionVariacion, string> = { sube: "Aumento de", baja: "Disminución de", igual: "Sin cambio," };

/**
 * Variación contra el período anterior: flecha + porcentaje + "vs. período
 * anterior". `invertido`: para métricas donde un valor más alto es peor
 * (Rechazadas, Con novedades) — el color se invierte, pero la flecha siempre
 * refleja la dirección real del número. No renderiza nada si no hay base de
 * comparación (ambos períodos en 0).
 */
export function VariacionDelta({
  actual,
  anterior,
  invertido = false,
}: {
  actual: number;
  anterior: number;
  invertido?: boolean;
}) {
  const v = variacion(actual, anterior);
  if (!v) return null;
  const tono = tonoVariacion(v.direccion, invertido);

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${COLOR_POR_TONO[tono]}`}>
        <Icono nombre={ICONO_POR_DIRECCION[v.direccion]} className="size-3.5" />
        <span className="sr-only">{TEXTO_SR[v.direccion]}</span>
        {v.porcentaje}%
      </span>
      <span className="text-ink-muted">vs. período anterior</span>
    </span>
  );
}
