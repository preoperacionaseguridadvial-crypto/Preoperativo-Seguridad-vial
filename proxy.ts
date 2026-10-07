import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/base-config";
import { getRequiredRoles } from "@/lib/auth/route-roles";

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

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
