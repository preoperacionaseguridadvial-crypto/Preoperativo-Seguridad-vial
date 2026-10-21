// "Recordarme" del login. NextAuth fija una sola duración para la cookie de
// sesión (30 días), así que "sesión hasta cerrar el navegador" se arma aparte:
// al iniciar sesión sin Recordarme se guarda `recordar: false` en el token y
// una cookie marcador SIN vencimiento (se borra cuando el navegador se
// cierra). Proxy, si ve ese token sin el marcador, cierra la sesión.
// Sin dependencias de servidor: lo importa Proxy.
export const COOKIE_SESION_NAVEGADOR = "ess-sesion-navegador";

/**
 * `recordar` viene del JWT; `undefined` es una sesión anterior a esta función
 * y se trata como "recordar" para no sacar a quien ya tenía sesión.
 */
export function sesionExpiradaPorNavegador({
  recordar,
  tieneMarcador,
}: {
  recordar: boolean | undefined;
  tieneMarcador: boolean;
}): boolean {
  return recordar === false && !tieneMarcador;
}

/** El formulario llega al Credentials provider como texto: solo "false" desmarca. */
export function recordarDesdeCredenciales(valor: unknown): boolean {
  return valor !== "false";
}

// Cookie de sesión de NextAuth: con prefijo seguro en HTTPS y partida en
// trozos (`.0`, `.1`) si el token es grande.
const PATRON_COOKIE_SESION = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

export function esCookieDeSesion(nombre: string): boolean {
  return PATRON_COOKIE_SESION.test(nombre);
}
