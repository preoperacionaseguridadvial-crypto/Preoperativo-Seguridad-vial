/**
 * Arma la URL del dashboard con los query params actuales más los overrides
 * indicados (los que vengan en `undefined` se quitan). Usado por todos los
 * links que "cambian una cosa sin perder el resto de los filtros" —
 * períodos rápidos, toggle de vista del gráfico, orden de tablas,
 * paginación — sin JavaScript de cliente, todo re-render server-side.
 */
export function buildDashboardUrl(
  base: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
