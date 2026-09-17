import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getUsuarios } from "@/lib/admin/queries";
import { Role } from "@/generated/prisma/client";

const ROLES_FILTRO = Object.values(Role);

type SearchParams = { q?: string; rol?: string; estado?: string };

// Lista de todos los usuarios (cualquier rol) para el Administrador. Ningún
// usuario se borra nunca — "Activo" es la única forma de desactivar uno sin
// perder el registro. Filtros vía query string (form GET sin JS, mismo
// patrón ya usado en consulta-inspecciones/dashboard).
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
  const rolValido = rol && (ROLES_FILTRO as string[]).includes(rol) ? (rol as Role) : undefined;
  const activo = estado === "activo" ? true : estado === "inactivo" ? false : undefined;

  const usuarios = await getUsuarios({ q, role: rolValido, activo });
  const hayFiltros = Boolean(q || rolValido || estado);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B3B60]">Usuarios</h1>
          <p className="text-sm text-gray-500">Crear, editar y restablecer contraseñas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/vehiculos"
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Ver vehículos
          </Link>
          <Link
            href="/admin/usuarios/nuevo"
            className="rounded-md bg-[#0B3B60] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
          >
            Crear usuario
          </Link>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-gray-700">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Nombre, email o cédula"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#005B96] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="rol" className="mb-1 block text-xs font-medium text-gray-700">
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            defaultValue={rolValido ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#005B96] focus:outline-none"
          >
            <option value="">Todos</option>
            {ROLES_FILTRO.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="mb-1 block text-xs font-medium text-gray-700">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#005B96] focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-[#0B3B60] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3B60]/90"
        >
          Buscar
        </button>
        {hayFiltros && (
          <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
            Limpiar filtros
          </Link>
        )}
      </form>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        {usuarios.length === 0 ? (
          <p className="text-sm text-gray-500">
            {hayFiltros ? "No se encontraron usuarios con esos filtros." : "No hay usuarios registrados."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2 font-medium">Nombre</th>
                  <th className="py-2 pr-2 font-medium">Email</th>
                  <th className="py-2 pr-2 font-medium">Rol</th>
                  <th className="py-2 pr-2 font-medium">Cédula</th>
                  <th className="py-2 pr-2 font-medium">Tipo de vehículo</th>
                  <th className="py-2 pr-2 font-medium">Cargo</th>
                  <th className="py-2 pr-2 font-medium">Activo</th>
                  <th className="py-2 pr-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-2 font-medium text-[#0B3B60]">{usuario.name}</td>
                    <td className="py-2 pr-2">{usuario.email}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{usuario.role}</td>
                    <td className="py-2 pr-2">{usuario.cedula ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {usuario.tipoVehiculo ??
                        (usuario.role === Role.TRABAJADOR ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Pendiente de asignación
                          </span>
                        ) : (
                          "—"
                        ))}
                    </td>
                    <td className="py-2 pr-2">{usuario.cargo ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {usuario.activo ? (
                        "Sí"
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <Link href={`/admin/usuarios/${usuario.id}`} className="text-[#005B96] hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
