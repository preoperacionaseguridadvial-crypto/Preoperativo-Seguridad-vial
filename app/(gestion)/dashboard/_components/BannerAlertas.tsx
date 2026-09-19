import Link from "next/link";
import type { FallaPorItem, FilaVehiculo, KpisConComparacion } from "@/lib/inspections/reportes-queries";
import { alertasAdicionales, hrefBanner, textoBanner } from "./alertas";
import { Icono } from "./Iconos";

/**
 * Banner ámbar de "Requiere atención". Solo alertas con dato real detrás
 * (regla explícita del pedido — nada de "fuera de horario" ni "bajo
 * cumplimiento de asistencia", el sistema no tiene esa información): la
 * frase principal sale de rechazadas + pendientes de aprobación; debajo van
 * los vehículos con 2+ novedades y el ítem con más fallas. Sin alertas no
 * renderiza nada.
 */
export function BannerAlertas({
  kpis,
  vehiculos,
  topFalla,
}: {
  kpis: KpisConComparacion;
  vehiculos: FilaVehiculo[];
  topFalla: FallaPorItem | undefined;
}) {
  const texto = textoBanner(kpis.rechazadas, kpis.pendientesAprobacion);
  const adicionales = alertasAdicionales({ vehiculos, topFalla });
  if (!texto && adicionales.length === 0) return null;

  return (
    <section
      aria-label="Requiere atención"
      className="flex flex-col gap-2 rounded-xl border border-status-warn/50 bg-status-warn-soft px-4 py-3 text-status-warn-ink"
    >
      {texto && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Icono nombre="alerta" className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">{texto}</p>
          <Link
            href={hrefBanner(kpis.rechazadas, kpis.pendientesAprobacion)}
            className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-status-info-ink hover:underline"
          >
            Ver inspecciones
            <Icono nombre="flecha" className="size-4" />
          </Link>
        </div>
      )}
      {adicionales.length > 0 && (
        <ul className={`flex flex-col gap-1 text-sm ${texto ? "border-t border-status-warn/40 pt-2" : ""}`}>
          {adicionales.map((a) => (
            <li key={a.texto} className="flex items-start gap-2">
              <Icono nombre="alerta" className="mt-0.5 size-4 shrink-0" />
              {a.href ? (
                <Link href={a.href} className="hover:underline">
                  {a.texto}
                </Link>
              ) : (
                <span>{a.texto}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
