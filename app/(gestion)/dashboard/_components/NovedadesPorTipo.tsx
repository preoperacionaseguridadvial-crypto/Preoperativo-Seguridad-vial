import type { NovedadPorTipo } from "@/lib/inspections/reportes-queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { BarraRanking } from "./BarraRanking";
import { Tarjeta } from "./Tarjeta";

/**
 * "Novedades por tipo", agrupadas por `TipoNovedad`, con la cantidad y su
 * porcentaje. Sin link a detalle: `consulta-inspecciones` no filtra por tipo
 * de novedad hoy, y agregarle ese filtro es un cambio aparte, fuera de este
 * pedido. Los tipos son categorías sin orden de gravedad, así que todas las
 * barras llevan un único color de identidad (azul), no una escala.
 */
export function NovedadesPorTipo({ datos, className = "" }: { datos: NovedadPorTipo[]; className?: string }) {
  return (
    <Tarjeta titulo="Novedades por tipo" className={className}>
      <BarraRanking
        data={datos.map((d) => ({ label: TIPO_NOVEDAD_LABELS[d.tipo], value: d.cantidad, detalle: `(${d.porcentaje}%)` }))}
        color="var(--color-viz-blue)"
        emptyMessage="No hay novedades reportadas en el período seleccionado."
      />
    </Tarjeta>
  );
}
