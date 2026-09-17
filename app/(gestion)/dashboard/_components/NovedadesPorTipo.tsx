import type { NovedadPorTipo } from "@/lib/inspections/reportes-queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { BarraRanking } from "./BarraRanking";

/**
 * "Principales novedades detectadas", agrupadas por `TipoNovedad`. Sin link
 * a detalle: `consulta-inspecciones` no filtra por tipo de novedad hoy, y
 * agregarle ese filtro es un cambio aparte, fuera de este pedido.
 */
export function NovedadesPorTipo({ datos }: { datos: NovedadPorTipo[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Principales novedades detectadas</h2>
      <BarraRanking
        data={datos.map((d) => ({ label: TIPO_NOVEDAD_LABELS[d.tipo], value: d.cantidad }))}
        color="#d03b3b"
        emptyMessage="No hay novedades reportadas en el período seleccionado."
      />
      {datos.length > 0 && (
        <p className="text-xs text-gray-400">
          {datos.map((d) => `${TIPO_NOVEDAD_LABELS[d.tipo]}: ${d.porcentaje}%`).join(" · ")}
        </p>
      )}
    </section>
  );
}
