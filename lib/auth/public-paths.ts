// Rutas públicas: no requieren sesión. "/api/auth" incluye signin/signout/
// callback/session/csrf de NextAuth, que deben ser accesibles sin sesión
// (si no, nadie podría iniciar sesión). "/terminos" y "/privacidad" son los
// textos legales enlazados desde el pie de todas las páginas, incluido el
// login: el titular debe poder leerlos antes de entregar sus datos.
// Sin dependencias de servidor: lo importa Proxy.
const PUBLIC_PATHS = ["/login", "/api/auth", "/terminos", "/privacidad"];

// Carpetas de public/ con imágenes de guía (fotos de referencia, sin datos
// personales). Solo se abren los archivos de adentro, no la carpeta: con
// sesión obligatoria, un pedido sin cookie (p. ej. el que hace el navegador
// antes de iniciar sesión) recibía la página de login en vez de la imagen.
const PUBLIC_ASSET_DIRS = ["/checklist/", "/estado-conductor/", "/fotos-guia/"];

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    PUBLIC_ASSET_DIRS.some((dir) => pathname.startsWith(dir) && pathname.length > dir.length)
  );
}
