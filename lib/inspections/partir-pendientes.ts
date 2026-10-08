import { requiereAtencionPendiente } from "@/lib/inspections/estado-conductor";

type ParaAtencion = Parameters<typeof requiereAtencionPendiente>[0];

/** Separa las pendientes en "requieren atención" y "sin alertas", conservando el orden de entrada. */
export function partirPendientes<T extends ParaAtencion>(pendientes: T[]) {
  return {
    conAlerta: pendientes.filter(requiereAtencionPendiente),
    sinAlerta: pendientes.filter((inspection) => !requiereAtencionPendiente(inspection)),
  };
}

/** Las que requieren atención primero, luego el resto; el orden relativo se mantiene. */
export function ordenarPendientesPorAtencion<T extends ParaAtencion>(pendientes: T[]): T[] {
  const { conAlerta, sinAlerta } = partirPendientes(pendientes);
  return [...conAlerta, ...sinAlerta];
}
