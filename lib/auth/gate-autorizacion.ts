// Barrera de la autorización de tratamiento de datos (Ley 1581 de 2012): un
// usuario con sesión no puede usar la app hasta firmarla (app/autorizacion).
// Las rutas públicas (lib/auth/public-paths.ts) se resuelven antes, en Proxy.
// Sin dependencias de servidor: lo importa Proxy.
export const RUTA_AUTORIZACION = "/autorizacion";

/**
 * Ruta a la que hay que redirigir, o `null` si se deja pasar. `autorizoDatos`
 * viene del JWT; `undefined` es una sesión anterior a esta función y se trata
 * como no autorizada.
 */
export function destinoPorAutorizacion(pathname: string, autorizoDatos: boolean | undefined): string | null {
  const enPantallaDeAutorizacion = pathname === RUTA_AUTORIZACION;
  if (autorizoDatos === true) {
    return enPantallaDeAutorizacion ? "/" : null;
  }
  return enPantallaDeAutorizacion ? null : RUTA_AUTORIZACION;
}
