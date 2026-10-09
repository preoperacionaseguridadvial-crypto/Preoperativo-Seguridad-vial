// Rutas públicas: no requieren sesión. "/api/auth" incluye signin/signout/
// callback/session/csrf de NextAuth, que deben ser accesibles sin sesión
// (si no, nadie podría iniciar sesión). "/terminos" y "/privacidad" son los
// textos legales enlazados desde el pie de todas las páginas, incluido el
// login: el titular debe poder leerlos antes de entregar sus datos.
// Sin dependencias de servidor: lo importa Proxy.
const PUBLIC_PATHS = ["/login", "/api/auth", "/terminos", "/privacidad"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
