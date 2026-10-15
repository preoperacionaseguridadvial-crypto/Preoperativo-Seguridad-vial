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
 * Limpia lo que llega al pegar en una terminal en modo crudo: marcas de
 * "bracketed paste", caracteres de control (Ctrl+V llega como \u0016),
 * comillas y espacios alrededor.
 */
export function limpiarUrlPegada(texto: string): string {
  return texto
    .replace(/\u001b\[20[01]~/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * Explica por qué una URL no sirve, sin mostrar su contenido (puede traer la
 * contraseña de la base): solo su largo.
 */
export function diagnosticarUrl(url: string): string {
  if (!url) {
    return "No se recibió ningún texto. En PowerShell pegá con clic derecho (Ctrl+V no funciona en la entrada oculta).";
  }
  if (url.includes("${{")) {
    return "Se pegó la plantilla de Railway (con ${{ }}), no el valor real. Copiá el valor con ⋮ → Copy value.";
  }
  return `La URL no es de PostgreSQL: debe empezar con postgresql:// (se recibieron ${url.length} caracteres).`;
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
