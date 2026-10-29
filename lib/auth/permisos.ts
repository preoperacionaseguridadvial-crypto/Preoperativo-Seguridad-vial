// Reglas de permisos por rol (nunca por email). Puras y sin `server-only` ni
// imports de runtime (strings literales) para poder usarlas desde páginas,
// route handlers y componentes.

/**
 * ADMINISTRADOR tiene TODO lo que tiene el rol SST ("Administrador SST") y
 * además gestiona cuentas de Administrador. Usar esto en cada capacidad que
 * antes era "solo SST" (otorgar habilitaciones, PDF, Excel, etc.).
 */
export function tienePermisosSst(rol: string): boolean {
  return rol === "SST" || rol === "ADMINISTRADOR";
}

/** Solo un ADMINISTRADOR crea o modifica cuentas de ADMINISTRADOR. */
export function puedeGestionarAdministradores(rol: string): boolean {
  return rol === "ADMINISTRADOR";
}

/**
 * Solo un ADMINISTRADOR elimina definitivamente una inspección (cualquier
 * estado). Ni SST ni los aprobadores: el borrado es irreversible.
 */
export function puedeEliminarInspecciones(rol: string): boolean {
  return rol === "ADMINISTRADOR";
}
