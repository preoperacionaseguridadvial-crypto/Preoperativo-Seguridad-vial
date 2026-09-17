/**
 * Progreso de inspección — componente de presentación puro, compartido por
 * la pantalla de lista (app/(worker)/inspecciones/[id]/checklist/page.tsx)
 * y la pantalla de ítem individual
 * (app/(worker)/inspecciones/[id]/checklist/[itemId]/page.tsx). No hace
 * ninguna query: recibe los conteos ya calculados desde
 * `getChecklistEstadoCompleto` (única fuente de verdad, ver
 * lib/inspections/queries.ts) para que las dos pantallas nunca puedan
 * mostrar números distintos entre sí.
 *
 * "Revisado" = OK o FALLA (cualquier respuesta registrada); PENDIENTE es el
 * único estado que no cuenta como revisado — ver `revisados` en los
 * callers, que ya se calcula como `total - pendientes`.
 */
export function ProgresoInspeccion({
  revisados,
  total,
  conformes,
  noConformes,
  pendientes,
}: {
  revisados: number;
  total: number;
  conformes: number;
  noConformes: number;
  pendientes: number;
}) {
  const porcentaje = total === 0 ? 0 : Math.round((revisados / total) * 100);

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[#D9E2EA] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2.5 sm:shrink-0">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D9E2EA] bg-[#F4F7FA] shadow-sm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#005B96"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="3" width="12" height="18" rx="2" />
            <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
            <path d="M9 10h6" />
            <path d="M9 13.5h6" />
            <path d="M9 17h3.5" />
          </svg>
        </div>
        <div className="sm:hidden">
          <p className="text-sm font-semibold text-[#17324D]">Progreso de inspección</p>
          <p className="text-xs text-[#66788A]">
            {revisados} de {total} ítems revisados
          </p>
        </div>
      </div>

      <div className="hidden sm:block sm:shrink-0">
        <p className="text-sm font-semibold text-[#17324D]">Progreso de inspección</p>
        <p className="text-xs text-[#66788A]">
          {revisados} de {total} ítems revisados
        </p>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso de inspección: ${revisados} de ${total} ítems revisados, ${porcentaje} por ciento.`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"
        >
          <div
            className="h-full rounded-full bg-[#005B96] transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-semibold text-[#005B96]">{porcentaje}%</span>
      </div>

      <p className="shrink-0 text-xs font-medium text-[#66788A] sm:pl-2">
        🟢 {conformes} · 🔴 {noConformes} · ⚪ {pendientes}
      </p>
    </div>
  );
}
