import { describe, expect, it, vi } from "vitest";

// proxy.ts (RBAC de rutas) no toca la base de datos, así que acá sí mockeamos
// en vez de usar Postgres real: `NextAuth(authConfig)` se reemplaza por un
// factory que devuelve el propio handler sin envolverlo (`auth: (handler) =>
// handler`), para poder invocar la lógica de proxy.ts directamente con un
// `req` fabricado (`nextUrl` + `auth`, que es exactamente lo que NextAuth le
// inyecta al request real) sin pasar por sesión/JWT real.
vi.mock("next-auth", () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));

import type { Role } from "@/generated/prisma/client";

type Handler = (req: { nextUrl: URL; auth: { user: { role: Role } } | null }) => Response;

function crearRequest(pathname: string, role: Role | null) {
  return {
    nextUrl: new URL(`http://localhost${pathname}`),
    auth: role ? { user: { role } } : null,
  };
}

async function importMiddleware() {
  const mod = await import("./proxy");
  return mod.default as unknown as Handler;
}

describe("proxy.ts (RBAC por rol)", () => {
  it("permite a TRABAJADOR entrar a /inspecciones", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/inspecciones", "TRABAJADOR") as Parameters<Handler>[0]);
    expect(res.headers.get("location")).toBeNull();
  });

  it("rechaza a SUPERVISOR en /inspecciones (ruta cruzada) redirigiendo a /", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/inspecciones", "SUPERVISOR") as Parameters<Handler>[0]);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("permite a SUPERVISOR entrar a /aprobaciones", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/aprobaciones", "SUPERVISOR") as Parameters<Handler>[0]);
    expect(res.headers.get("location")).toBeNull();
  });

  it("rechaza a TRABAJADOR en /aprobaciones redirigiendo a /", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/aprobaciones", "TRABAJADOR") as Parameters<Handler>[0]);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it.each(["DIRECTOR", "SST"] as const)(
    "permite a %s entrar a /consulta-inspecciones y /dashboard",
    async (role) => {
      const middleware = await importMiddleware();
      const resConsulta = middleware(
        crearRequest("/consulta-inspecciones", role) as Parameters<Handler>[0],
      );
      const resDashboard = middleware(crearRequest("/dashboard", role) as Parameters<Handler>[0]);
      expect(resConsulta.headers.get("location")).toBeNull();
      expect(resDashboard.headers.get("location")).toBeNull();
    },
  );

  it("rechaza a TRABAJADOR y SUPERVISOR en /dashboard", async () => {
    const middleware = await importMiddleware();
    for (const role of ["TRABAJADOR", "SUPERVISOR"] as const) {
      const res = middleware(crearRequest("/dashboard", role) as Parameters<Handler>[0]);
      expect(res.headers.get("location")).toBe("http://localhost/");
    }
  });

  it.each(["ADMINISTRADOR", "SST"] as const)(
    "permite a %s entrar a la gestión de usuarios (/admin/usuarios, /nuevo, /[id])",
    async (role) => {
      const middleware = await importMiddleware();
      for (const path of ["/admin/usuarios", "/admin/usuarios/nuevo", "/admin/usuarios/abc123"]) {
        const res = middleware(crearRequest(path, role) as Parameters<Handler>[0]);
        expect(res.headers.get("location"), path).toBeNull();
      }
    },
  );

  // SST tiene los mismos permisos que ADMINISTRADOR en todo /admin (decisión
  // del usuario, 2026-09-18): configuración y la raíz /admin incluidas.
  it.each(["ADMINISTRADOR", "SST"] as const)(
    "permite a %s entrar a todo el panel /admin (raíz y configuración)",
    async (role) => {
      const middleware = await importMiddleware();
      for (const path of ["/admin", "/admin/configuracion"]) {
        const res = middleware(crearRequest(path, role) as Parameters<Handler>[0]);
        expect(res.headers.get("location"), path).toBeNull();
      }
    },
  );

  it("rechaza a TRABAJADOR, SUPERVISOR y DIRECTOR en /admin y /admin/configuracion", async () => {
    const middleware = await importMiddleware();
    for (const role of ["TRABAJADOR", "SUPERVISOR", "DIRECTOR"] as const) {
      for (const path of ["/admin", "/admin/configuracion"]) {
        const res = middleware(crearRequest(path, role) as Parameters<Handler>[0]);
        expect(res.headers.get("location"), `${role} ${path}`).toBe("http://localhost/");
      }
    }
  });

  it("permite a ADMINISTRADOR y SST entrar a la hoja de vida de un usuario (cuelga de /admin/usuarios)", async () => {
    const middleware = await importMiddleware();
    for (const role of ["ADMINISTRADOR", "SST"] as const) {
      const res = middleware(
        crearRequest("/admin/usuarios/abc123/hoja-de-vida", role) as Parameters<Handler>[0],
      );
      expect(res.headers.get("location"), role).toBeNull();
    }
  });

  it("rechaza a TRABAJADOR, SUPERVISOR y DIRECTOR en /admin/usuarios", async () => {
    const middleware = await importMiddleware();
    for (const role of ["TRABAJADOR", "SUPERVISOR", "DIRECTOR"] as const) {
      const res = middleware(crearRequest("/admin/usuarios", role) as Parameters<Handler>[0]);
      expect(res.headers.get("location"), role).toBe("http://localhost/");
    }
  });

  it("redirige a /login (con callbackUrl) cuando no hay sesión en una ruta protegida", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/inspecciones", null) as Parameters<Handler>[0]);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/inspecciones");
  });

  it("deja pasar rutas públicas (/login, /api/auth/*) sin sesión", async () => {
    const middleware = await importMiddleware();
    const resLogin = middleware(crearRequest("/login", null) as Parameters<Handler>[0]);
    const resAuth = middleware(crearRequest("/api/auth/session", null) as Parameters<Handler>[0]);
    expect(resLogin.headers.get("location")).toBeNull();
    expect(resAuth.headers.get("location")).toBeNull();
  });

  it("permite acceso a rutas sin prefijo restringido (ej. /) a cualquier rol autenticado", async () => {
    const middleware = await importMiddleware();
    const res = middleware(crearRequest("/", "TRABAJADOR") as Parameters<Handler>[0]);
    expect(res.headers.get("location")).toBeNull();
  });
});
