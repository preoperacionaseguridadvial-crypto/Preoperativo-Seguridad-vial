// Distribución aprobadas/rechazadas/pendientes en una única barra apilada
// horizontal (en vez de donut): mismo criterio de la guía de dataviz ya
// aplicada en este dashboard — una barra da lectura más precisa que un
// donut para comparar 3 valores. Mismos hex de status que el resto del
// dashboard (verde/rojo/amarillo), siempre con etiqueta al lado, nunca el
// color solo.
const SEGMENTOS = [
  { key: "aprobadas" as const, label: "Aprobadas", color: "#0ca30c" },
  { key: "rechazadas" as const, label: "Rechazadas", color: "#d03b3b" },
  { key: "pendientes" as const, label: "Pendientes", color: "#fab219" },
];

export function EstadoBarra({
  aprobadas,
  rechazadas,
  pendientes,
}: {
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
}) {
  const valores = { aprobadas, rechazadas, pendientes };
  const total = aprobadas + rechazadas + pendientes;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Estado de inspecciones</h2>

      <div className="flex items-center gap-4">
        <span className="text-3xl font-semibold text-[#0B3B60]">{total}</span>
        <span className="text-xs text-gray-500">inspecciones del período</span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-gray-500">No hay inspecciones en el período seleccionado.</p>
      ) : (
        <>
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
            {SEGMENTOS.map((s) => {
              const valor = valores[s.key];
              if (valor === 0) return null;
              return (
                <div
                  key={s.key}
                  style={{ width: `${(valor / total) * 100}%`, backgroundColor: s.color }}
                  title={`${s.label}: ${valor}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {SEGMENTOS.map((s) => (
              <span key={s.key} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}: {valores[s.key]}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
