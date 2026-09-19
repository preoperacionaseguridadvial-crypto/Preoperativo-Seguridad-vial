import Link from "next/link";
import { accionesRapidasPara } from "./acciones-rapidas";
import { Icono } from "./Iconos";
import { Tarjeta } from "./Tarjeta";

/**
 * Panel "Acciones rápidas": solo enlaces a rutas que existen y que el rol del
 * visor puede abrir (`accionesRapidasPara` espeja proxy.ts y la validación de
 * la ruta de Excel) — nada que termine en 403 o en redirect.
 */
export function AccionesRapidas({ role, urlExcel, className = "" }: { role: string; urlExcel: string; className?: string }) {
  const acciones = accionesRapidasPara(role, urlExcel);
  const claseItem =
    "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-page focus-visible:outline-2 focus-visible:outline-brand";
  const icono = (nombre: (typeof acciones)[number]["icono"]) => (
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-status-info-soft text-status-info-ink">
      <Icono nombre={nombre} className="size-4" />
    </span>
  );

  return (
    <Tarjeta className={className}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icono nombre="rayo" className="size-4 text-status-info-ink" />
        Acciones rápidas
      </h2>
      <ul className="flex flex-col gap-0.5">
        {acciones.map((a) => (
          <li key={a.href}>
            {a.descarga ? (
              <a href={a.href} className={claseItem}>
                {icono(a.icono)}
                {a.etiqueta}
              </a>
            ) : (
              <Link href={a.href} className={claseItem}>
                {icono(a.icono)}
                {a.etiqueta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
