// Validación pura de `scripts/crear-admin.ts` (sin Prisma ni terminal) para
// poder probarla sin base de datos.

/** Mínimo para el primer Administrador: tiene acceso total, más que el panel (8). */
export const MIN_PASSWORD_ADMIN = 12;

export type DatosAdmin = { nombre: string; email: string; cedula: string | null; password: string };

export function validarDatosAdmin(entrada: {
  nombre: string;
  email: string;
  cedula: string;
  password: string;
  confirmacion: string;
}): { ok: true; datos: DatosAdmin } | { ok: false; error: string } {
  const nombre = entrada.nombre.trim();
  const email = entrada.email.trim().toLowerCase();
  const cedula = entrada.cedula.trim() || null;

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El email no es válido." };
  if (entrada.password.length < MIN_PASSWORD_ADMIN) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_ADMIN} caracteres.` };
  }
  if (entrada.password !== entrada.confirmacion) return { ok: false, error: "Las contraseñas no coinciden." };

  return { ok: true, datos: { nombre, email, cedula, password: entrada.password } };
}

/**
 * Host, puerto y base de una URL de Postgres, sin usuario ni contraseña, para
 * mostrar a qué base se va a escribir. `null` si no es una URL de Postgres.
 */
export function describirBase(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
    return `${u.host}${u.pathname}`;
  } catch {
    return null;
  }
}
