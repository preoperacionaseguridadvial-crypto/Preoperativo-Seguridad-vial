// Helpers puros de los gráficos SVG a mano (sin librería de gráficos):
// escalas del eje Y, adelgazado de etiquetas del eje X, ancho de barras y la
// grilla de semanas del heatmap. Se prueban en graficos.test.ts.

/** Eje fijo de la vista "tasa de aprobación" (porcentaje). */
export const TICKS_TASA = [0, 25, 50, 75, 100];

/**
 * Ticks "redondos" (paso 1/2/5 × 10ⁿ) desde 0 hasta un valor que cubre el
 * máximo — enteros siempre, porque el eje cuenta inspecciones. Apunta a ~4
 * intervalos para no saturar el eje.
 */
export function ticksEje(maximo: number, objetivo = 4): number[] {
  const max = Math.max(1, maximo);
  const crudo = max / objetivo;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const normalizado = crudo / potencia;
  const multiplo = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  const paso = Math.max(1, multiplo * potencia);
  const tope = Math.ceil(max / paso) * paso;

  const ticks: number[] = [];
  for (let valor = 0; valor <= tope; valor += paso) ticks.push(valor);
  return ticks;
}

/**
 * Índices del eje X que llevan etiqueta: todos si caben; si no, a intervalos
 * regulares desde el primero, sin superar `maxEtiquetas` (rangos de hasta 400
 * días no amontonan texto).
 */
export function indicesEtiquetas(cantidad: number, maxEtiquetas: number): number[] {
  if (cantidad <= 0) return [];
  const paso = Math.max(1, Math.ceil(cantidad / maxEtiquetas));
  const indices: number[] = [];
  for (let i = 0; i < cantidad; i += paso) indices.push(i);
  return indices;
}

/** "2026-09-18" -> "18/09". */
export function formatoDiaMes(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

const ANCHO_MAX_BARRA = 24;

/** Ancho de barra dentro de su ranura: nunca llena la ranura, tope de 24px y mínimo 1px visible. */
export function anchoBarra(ranura: number): number {
  return Math.min(ANCHO_MAX_BARRA, Math.max(1, ranura * 0.7));
}

const RADIO_BARRA = 4;

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Trazo de una barra vertical con el extremo de datos (arriba) redondeado a
 * 4px y la base recta, para que crezca desde una única línea base. `y` es el
 * borde superior; la barra llega hasta `y + alto`. Vacío si no hay nada que dibujar.
 */
export function rutaBarra({ x, y, ancho, alto }: { x: number; y: number; ancho: number; alto: number }): string {
  if (ancho <= 0 || alto <= 0) return "";
  const r = Math.min(RADIO_BARRA, ancho / 2, alto);
  const [x0, x1, y0, yBase] = [x, x + ancho, y, y + alto].map(redondear);
  const [xi, xd, yr] = [x + r, x + ancho - r, y + r].map(redondear);
  return `M${x0} ${yBase} L${x0} ${yr} Q${x0} ${y0} ${xi} ${y0} L${xd} ${y0} Q${x1} ${y0} ${x1} ${yr} L${x1} ${yBase} Z`;
}

/**
 * Filas de 7 columnas (lunes primero) para el heatmap: huecos `null` antes
 * del primer día y después del último, así cada fila queda completa y el
 * día de la semana coincide con su columna.
 */
export function construirGrillaSemanal<T extends { fecha: string }>(datos: T[]): (T | null)[][] {
  if (datos.length === 0) return [];
  const primerDia = new Date(`${datos[0].fecha}T00:00:00Z`);
  const desfase = (primerDia.getUTCDay() + 6) % 7; // 0 = lunes

  const celdas: (T | null)[] = [...Array<null>(desfase).fill(null), ...datos];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const filas: (T | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));
  return filas;
}

const OPACIDAD_MIN = 0.15;

/** Opacidad de la celda del heatmap según la tasa de aprobación (0-100): un día con tasa 0 sigue siendo distinguible de uno sin inspecciones. */
export function opacidadCelda(tasa: number): number {
  const acotada = Math.min(100, Math.max(0, tasa));
  return OPACIDAD_MIN + (acotada / 100) * (1 - OPACIDAD_MIN);
}
