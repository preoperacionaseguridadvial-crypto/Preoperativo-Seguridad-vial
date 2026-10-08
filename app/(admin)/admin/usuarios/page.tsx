import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getUsuarios } from "@/lib/admin/queries";
import { ROLES_ASIGNABLES } from "@/lib/auth/etiquetas-rol";
import { ListaUsuarios } from "./_components/ListaUsuarios";

type SearchParams = { q?: string; rol?: string; estado?: string };

// Lista de todos los usuarios (cualquier rol) para el Administrador. Ningún
// usuario se borra nunca — "Activo" es la única forma de desactivar uno sin
// perder el registro. Se carga completa y la búsqueda/filtros corren en el
// navegador (ListaUsuarios); la URL (?q, ?rol, ?estado) solo fija los valores
// iniciales para no romper enlaces existentes.
export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { q, rol, estado } = await searchParams;
  const rolValido = rol && (ROLES_ASIGNABLES as readonly string[]).includes(rol) ? rol : "";
  const estadoValido = estado === "activo" || estado === "inactivo" ? estado : "";

  const usuarios = await getUsuarios();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Usuarios</h1>
          <p className="text-sm text-ink-muted">Crear, editar y restablecer contraseñas.</p>
        </div>
        <Link
          href="/admin/configuracion"
          className="flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Configuración
        </Link>
      </div>

      <Link
        href="/admin/usuarios/nuevo"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 active:opacity-90"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Crear usuario
      </Link>

      <ListaUsuarios
        usuarios={usuarios.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          sede: u.sede,
          cedula: u.cedula,
          cargo: u.cargo,
          activo: u.activo,
          tipoVehiculo: u.tipoVehiculo,
          vehicle: u.vehicle ? { placa: u.vehicle.placa } : null,
        }))}
        qInicial={q ?? ""}
        rolInicial={rolValido}
        estadoInicial={estadoValido}
      />
    </main>
  );
}
