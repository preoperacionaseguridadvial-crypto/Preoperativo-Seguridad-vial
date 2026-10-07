import type { Role } from "@/generated/prisma/client";

/**
 * Prefijos de ruta -> roles permitidos. Esta es la primera barrera (a nivel
 * de ruta); la validación de negocio real vuelve a hacerse siempre dentro de
 * cada server action / route handler con `requireRole` (ver
 * lib/auth/requireRole.ts), porque Proxy nunca debe ser la única defensa.
 *
 * Vive acá (y no dentro de proxy.ts) para que el inicio por rol pueda
 * derivar sus atajos del mismo mapa y un test garantice que nunca apunten a
 * una ruta que el proxy le niega al rol. Sin dependencias de servidor: lo
 * importa Proxy.
 */
export const ROLE_ROUTE_PREFIXES: Record<string, Role[]> = {
  "/inspecciones": ["TRABAJADOR"],
  "/aprobaciones": ["SUPERVISOR"],
  "/consulta-inspecciones": ["DIRECTOR", "SST", "SUPERVISOR", "ADMINISTRADOR"],
  "/dashboard": ["DIRECTOR", "SST", "ADMINISTRADOR"],
  // SST tiene los mismos permisos que ADMINISTRADOR en todo el panel
  // (decisión del usuario, 2026-09-18): usuarios, hoja de vida y
  // configuración. Si se agrega un permiso nuevo a ADMINISTRADOR, agregarlo
  // también a SST (y a su requireRole).
  "/admin": ["ADMINISTRADOR", "SST"],
};

/** Roles exigidos por la ruta, o `null` si ningún prefijo la restringe. */
export function getRequiredRoles(pathname: string): Role[] | null {
  for (const [prefix, roles] of Object.entries(ROLE_ROUTE_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return roles;
    }
  }
  return null;
}

/** `true` si el proxy deja a `role` abrir `pathname`. */
export function puedeAccederARuta(role: Role, pathname: string): boolean {
  const requiredRoles = getRequiredRoles(pathname);
  return !requiredRoles || requiredRoles.includes(role);
}
