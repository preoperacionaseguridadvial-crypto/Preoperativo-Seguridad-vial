import Link from "next/link";
import { auth, signOut } from "@/lib/auth/config";

// Landing mínima de la Fase 1: solo confirma que la sesión y el rol
// funcionan de punta a punta. El checklist/dashboard/reportes reales se
// construyen en fases posteriores.
export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-[#0B3B60]">
        Preoperacional Seguridad Vial
      </h1>
      <p className="text-sm text-gray-500">ESS LTDA — Fase 1 (cimientos)</p>

      {user ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-700">
            Sesión activa: <span className="font-medium">{user.name}</span>{" "}
            (<span className="font-mono">{user.role}</span>)
          </p>
          {user.role === "TRABAJADOR" && (
            <Link
              href="/inspecciones"
              className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
            >
              Ir a inspecciones
            </Link>
          )}
          {user.role === "SUPERVISOR" && (
            <Link
              href="/aprobaciones"
              className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
            >
              Ir a aprobaciones
            </Link>
          )}
          {(user.role === "DIRECTOR" || user.role === "SST") && (
            <Link
              href="/dashboard"
              className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
            >
              Ir al dashboard
            </Link>
          )}
          {user.role === "ADMINISTRADOR" && (
            <Link
              href="/admin/usuarios"
              className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
            >
              Ir a administración
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-[#0B3B60] px-4 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/5"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : (
        <a
          href="/login"
          className="mt-6 rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
        >
          Iniciar sesión
        </a>
      )}
    </main>
  );
}
