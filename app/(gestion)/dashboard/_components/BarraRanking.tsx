// Barra horizontal rankeada, de presentación pura: sin interactividad (los
// valores van siempre visibles al lado de la barra, no dependen de hover),
// así que no hace falta "use client". Un solo color plano por instancia —
// no es una escala de magnitud por oscuridad, cada sección del dashboard
// (trabajadores, motos con novedades) le pasa su propio color de identidad.
export function BarraRanking({
  data,
  color,
  emptyMessage,
  formatValue,
}: {
  data: { label: string; value: number }[];
  color: string;
  emptyMessage: string;
  /** Formato del número mostrado a la derecha (ej. agregar "%") — por defecto, el valor tal cual. */
  formatValue?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value));
  const mostrar = formatValue ?? ((v: number) => String(v));

  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-gray-600" title={d.label}>
            {d.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-r-[4px]"
              style={{ width: `${Math.max((d.value / max) * 100, 4)}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-semibold text-[#0B3B60]">{mostrar(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
