import Link from "next/link";
import {
  accionPrincipalTrabajador,
  CLASES_TONO,
  tonoEstadoInspeccion,
} from "@/lib/inicio/accion-trabajador";
import { alertasDocumentosVehiculo } from "@/lib/inicio/vencimientos-vehiculo";
import type { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { estadoLegible } from "@/lib/inspections/reportes-queries";
import { TarjetaVehiculo } from "./TarjetaVehiculo";

type Datos = Awaited<ReturnType<typeof getDatosInicioTrabajador>>;

function formatoFechaHora(fecha: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(fecha);
}

/** Panel del TRABAJADOR (presentacional): vehículo, acción principal, alertas de documentos y últimas inspecciones. */
export function PanelTrabajador({ datos, ahora }: { datos: Datos; ahora: Date }) {
  const { vehiculo, inspecciones, fotoVehiculoUrl } = datos;

  if (!vehiculo) {
    return (
      <p className="rounded-xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink">
        Pendiente de asignación de vehículo: solicita al Administrador SST o al Administrador que complete tu hoja de vida.
      </p>
    );
  }

  const accion = accionPrincipalTrabajador(inspecciones[0] ?? null, ahora);
  const alertas = alertasDocumentosVehiculo(vehiculo, ahora);
  // Un vehículo inactivo no puede iniciar inspecciones (iniciarInspeccion lo
  // rechaza): solo se ofrece continuar una que ya está en proceso.
  const puedeIniciar = vehiculo.activo || accion.estado === "CONTINUAR";

  return (
    <div className="flex flex-col gap-5">
      <TarjetaVehiculo
        placa={vehiculo.placa}
        tipoVehiculo={vehiculo.tipoVehiculo}
        marca={vehiculo.marca}
        modelo={vehiculo.modelo}
        color={vehiculo.color}
        fotoUrl={fotoVehiculoUrl}
        vencimientos={vehiculo}
        ahora={ahora}
      />

      {!vehiculo.activo && (
        <p className="rounded-xl bg-status-warn-soft px-4 py-3 text-sm text-status-warn-ink">
          Tu vehículo {vehiculo.placa} está inactivo. Solicita al Administrador SST o al Administrador que lo reactive.
        </p>
      )}

      {alertas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {alertas.map((alerta) => (
            <li
              key={alerta.documento}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                alerta.estado === "VENCIDO" ? CLASES_TONO.crit : CLASES_TONO.warn
              }`}
            >
              {alerta.texto}
            </li>
          ))}
        </ul>
      )}

      <section className={`flex flex-col gap-3 rounded-xl p-4 ${CLASES_TONO[accion.tono]}`}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{accion.titulo}</h2>
          {accion.detalle && <p className="text-sm">{accion.detalle}</p>}
        </div>
        {accion.boton && puedeIniciar && (
          <Link
            href={accion.boton.href}
            className="flex min-h-14 items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-sm active:opacity-90"
          >
            {accion.boton.texto}
          </Link>
        )}
      </section>

      {inspecciones.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Últimas inspecciones</h2>
          <ul className="flex flex-col gap-2">
            {inspecciones.map((inspeccion) => (
              <li
                key={inspeccion.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
              >
                <span className="text-sm text-ink">{formatoFechaHora(inspeccion.startedAt)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLASES_TONO[tonoEstadoInspeccion(inspeccion.status)]}`}
                >
                  {estadoLegible(inspeccion.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
