import Link from "next/link";
import { CLASES_TONO } from "@/lib/inicio/accion-trabajador";
import type { getVehiculosConDocumentosPorVencer } from "@/lib/inicio/resumen-queries";
import { IconoFlecha } from "./Iconos";

const MAXIMO_VISIBLE = 5;
const CLASES_FILA = "flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm";

type Vehiculos = Awaited<ReturnType<typeof getVehiculosConDocumentosPorVencer>>;

function ContenidoFila({ vehiculo }: { vehiculo: Vehiculos[number] }) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-ink/20 bg-[#fde047] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-ink">
            {vehiculo.placa}
          </span>
          {vehiculo.conductor && <span className="truncate text-sm text-ink">{vehiculo.conductor.name}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {vehiculo.alertas.map((alerta) => (
            <span
              key={alerta.documento}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                alerta.estado === "VENCIDO" ? CLASES_TONO.crit : CLASES_TONO.warn
              }`}
            >
              {alerta.texto}
            </span>
          ))}
        </div>
      </div>
      {vehiculo.conductor && <IconoFlecha />}
    </>
  );
}

/** ADMINISTRADOR/SST: vehículos con SOAT o tecnomecánica vencidos o por vencer. */
export function VencimientosVehiculos({ vehiculos }: { vehiculos: Vehiculos }) {
  if (vehiculos.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Documentos de vehículos</h2>
        <p className={`rounded-xl px-4 py-3 text-sm font-medium ${CLASES_TONO.ok}`}>
          Todos los SOAT y tecnomecánicas están al día.
        </p>
      </section>
    );
  }

  const visibles = vehiculos.slice(0, MAXIMO_VISIBLE);
  const ocultos = vehiculos.length - visibles.length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Documentos de vehículos · {vehiculos.length} {vehiculos.length === 1 ? "vehículo" : "vehículos"} por atender
      </h2>
      <ul className="flex flex-col gap-2">
        {visibles.map((vehiculo) => (
          <li key={vehiculo.id}>
            {vehiculo.conductor ? (
              <Link href={`/admin/usuarios/${vehiculo.conductor.id}`} className={`${CLASES_FILA} active:bg-page`}>
                <ContenidoFila vehiculo={vehiculo} />
              </Link>
            ) : (
              <div className={CLASES_FILA}>
                <ContenidoFila vehiculo={vehiculo} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {ocultos > 0 && <p className="text-xs text-ink-muted">y {ocultos} más. Revisa Usuarios para ver el resto.</p>}
    </section>
  );
}
