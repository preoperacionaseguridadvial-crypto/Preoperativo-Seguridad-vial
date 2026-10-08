// `enums` y no `client`: lo importan Client Components.
import { Role } from "@/generated/prisma/enums";

// Helpers puros de la interfaz de usuarios del panel de administración
// (formulario por secciones y lista con búsqueda). Sin dependencias de servidor.

const DESCRIPCION_ROL: Record<Role, string> = {
  TRABAJADOR: "Hace la inspección preoperacional de su moto o carro.",
  SUPERVISOR_OLEARIARI: "Primera firma de las inspecciones de la sede Oleariari.",
  SUPERVISOR: "Aprueba las inspecciones y gestiona la operación diaria.",
  DIRECTOR: "Aprobación final y seguimiento de las inspecciones.",
  SST: "Administra usuarios, vehículos y la configuración de seguridad vial.",
  ADMINISTRADOR: "Administra usuarios, vehículos y la configuración del sistema.",
};

export function descripcionRol(rol: Role): string {
  return DESCRIPCION_ROL[rol];
}

/** Solo el Recorredor (TRABAJADOR) lleva sede y vehículo. */
export function llevaVehiculo(rol: string): boolean {
  return rol === Role.TRABAJADOR;
}

export type UsuarioFiltrable = {
  name: string;
  email: string;
  cedula: string | null;
  role: string;
  activo: boolean;
  vehicle: { placa: string } | null;
};

export type FiltrosLista = {
  q?: string;
  rol?: string;
  estado?: string;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Búsqueda parcial por nombre, email, cédula o placa + filtros de rol y estado. */
export function filtrarUsuarios<T extends UsuarioFiltrable>(usuarios: readonly T[], filtros: FiltrosLista): T[] {
  const q = normalizar(filtros.q ?? "");
  return usuarios.filter((u) => {
    if (filtros.rol && u.role !== filtros.rol) return false;
    if (filtros.estado === "activo" && !u.activo) return false;
    if (filtros.estado === "inactivo" && u.activo) return false;
    if (!q) return true;
    return [u.name, u.email, u.cedula ?? "", u.vehicle?.placa ?? ""].some((c) => normalizar(c).includes(q));
  });
}
