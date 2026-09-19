import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/base-config";
import type { Role } from "@/generated/prisma/client";

// Aunque Proxy (Next.js 16+, antes "middleware") corre en Node.js runtime
// por defecto, se usa igual `authConfig` (sin el Credentials provider) en
// vez de `auth` de lib/auth/config.ts, para no cargar bcrypt/Prisma en cada
// request que pasa por acá — solo se necesita decodificar el JWT. Ver el
// comentario en base-config.ts.
const { auth } = NextAuth(authConfig);

// Rutas públicas: no requieren sesión. "/api/auth" incluye signin/signout/
// callback/session/csrf de NextAuth, que deben ser accesibles sin sesión
// (si no, nadie podría iniciar sesión).
const PUBLIC_PATHS = ["/login", "/api/auth"];

/**
 * Prefijos de ruta -> roles permitidos. Esta es la primera barrera (a nivel
 * de ruta); la validación de negocio real vuelve a hacerse siempre dentro de
 * cada server action / route handler con `requireRole` (ver
 * lib/auth/requireRole.ts), porque Proxy nunca debe ser la única defensa.
 *
 * Fase 1 dejó este mapa vacío a propósito. Fase 2 agrega el flujo de
 * checklist del trabajador; Fase 3 agrega la revisión del Supervisor. El
 * resto (dashboard) sigue pendiente para fases futuras.
 */
const ROLE_ROUTE_PREFIXES: Record<string, Role[]> = {
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

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getRequiredRoles(pathname: string): Role[] | null {
  for (const [prefix, roles] of Object.entries(ROLE_ROUTE_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return roles;
    }
  }
  return null;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredRoles = getRequiredRoles(pathname);
  if (requiredRoles && !requiredRoles.includes(session.user.role)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Corre en todo menos assets estáticos, íconos, manifest y service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|logo/|manifest.json|sw.js|swe-worker-).*)",
  ],
};
