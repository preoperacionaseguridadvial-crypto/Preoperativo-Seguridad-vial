import Link from "next/link";
import type { FallaPorItem, FilaVehiculo, KpisConComparacion } from "@/lib/inspections/reportes-queries";

/**
 * "Requiere atención": solo alertas con dato real detrás (regla explícita
 * del pedido — nada de "fuera de horario" ni "bajo cumplimiento de
 * asistencia", el sistema no tiene esa información). Cada una linkea al
 * detalle correspondiente.
 */
export function AlertasEjecutivas({
  kpis,
  vehiculosConMultiplesNovedades,
  topFalla,
}: {
  kpis: KpisConComparacion;
  vehiculosConMultiplesNovedades: FilaVehiculo[];
  topFalla: FallaPorItem | undefined;
}) {
  const hayAlertas =
    kpis.rechazadas > 0 ||
    kpis.pendientesAprobacion > 0 ||
    vehiculosConMultiplesNovedades.length > 0 ||
    (topFalla && topFalla.cantidad >= 3);

  if (!hayAlertas) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Requiere atención</h2>
        <p className="text-sm text-gray-500">Sin alertas para el período seleccionado.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-500">Requiere atención</h2>
      <ul className="flex flex-col gap-2">
        {kpis.rechazadas > 0 && (
          <AlertaItem href="/consulta-inspecciones?estado=RECHAZADA">
            {kpis.rechazadas} inspección(es) rechazada(s) en el período
          </AlertaItem>
        )}
        {kpis.pendientesAprobacion > 0 && (
          <AlertaItem href="/consulta-inspecciones?estado=PENDIENTE_APROBACION">
            {kpis.pendientesAprobacion} inspección(es) pendiente(s) de aprobación
          </AlertaItem>
        )}
        {vehiculosConMultiplesNovedades.slice(0, 3).map((v) => (
          <AlertaItem key={v.vehicleId} href={`/consulta-inspecciones?placa=${encodeURIComponent(v.placa)}`}>
            Vehículo {v.placa} con {v.novedades} novedades en el período
          </AlertaItem>
        ))}
        {topFalla && topFalla.cantidad >= 3 && (
          <AlertaItem>
            &ldquo;{topFalla.nombre}&rdquo; presenta {topFalla.cantidad} fallas en el período
          </AlertaItem>
        )}
      </ul>
    </section>
  );
}

function AlertaItem({ children, href }: { children: React.ReactNode; href?: string }) {
  const contenido = (
    <span className="flex items-start gap-2 text-sm text-yellow-900">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </span>
  );
  if (!href) {
    return <li className="rounded-md bg-yellow-50 px-3 py-2">{contenido}</li>;
  }
  return (
    <li>
      <Link href={href} className="block rounded-md bg-yellow-50 px-3 py-2 hover:bg-yellow-100">
        {contenido}
      </Link>
    </li>
  );
}
