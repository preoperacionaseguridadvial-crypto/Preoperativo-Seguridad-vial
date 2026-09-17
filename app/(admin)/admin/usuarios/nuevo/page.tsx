import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { crearUsuario } from "@/lib/admin/user-actions";
import { Role, TipoVehiculo } from "@/generated/prisma/client";

const ROLES: Role[] = [Role.TRABAJADOR, Role.SUPERVISOR, Role.DIRECTOR, Role.SST, Role.ADMINISTRADOR];
const TIPOS_VEHICULO: TipoVehiculo[] = [TipoVehiculo.MOTO, TipoVehiculo.CARRO];

export default async function NuevoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function crearAction(formData: FormData) {
    "use server";
    const fechaVencimientoPaseRaw = formData.get("fechaVencimientoPase")?.toString();
    try {
      await crearUsuario({
        name: formData.get("name")?.toString() ?? "",
        email: formData.get("email")?.toString() ?? "",
        password: formData.get("password")?.toString() ?? "",
        passwordConfirmacion: formData.get("passwordConfirmacion")?.toString() ?? "",
        role: formData.get("role") as Role,
        cedula: formData.get("cedula")?.toString(),
        telefono: formData.get("telefono")?.toString(),
        cargo: formData.get("cargo")?.toString(),
        puestoAsignado: formData.get("puestoAsignado")?.toString(),
        tipoVehiculo: (formData.get("tipoVehiculo")?.toString() || undefined) as
          | TipoVehiculo
          | undefined,
        fechaVencimientoPase: fechaVencimientoPaseRaw ? new Date(fechaVencimientoPaseRaw) : undefined,
        conductorActivo: formData.get("conductorActivo") === "on",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el usuario.";
      redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/usuarios");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">Crear usuario</h1>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={crearAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres.</p>
        </div>

        <div>
          <label htmlFor="passwordConfirmacion" className="mb-1 block text-sm font-medium text-gray-700">
            Confirmar contraseña
          </label>
          <input
            id="passwordConfirmacion"
            name="passwordConfirmacion"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-700">
            Rol
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          >
            <option value="" disabled>
              Seleccioná un rol
            </option>
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cedula" className="mb-1 block text-sm font-medium text-gray-700">
            Cédula
          </label>
          <input
            id="cedula"
            name="cedula"
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Obligatoria si el rol es Trabajador.</p>
        </div>

        <div>
          <label htmlFor="tipoVehiculo" className="mb-1 block text-sm font-medium text-gray-700">
            Tipo de vehículo
          </label>
          <select
            id="tipoVehiculo"
            name="tipoVehiculo"
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {TIPOS_VEHICULO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Obligatorio si el rol es Trabajador.</p>
        </div>

        <div>
          <label htmlFor="puestoAsignado" className="mb-1 block text-sm font-medium text-gray-700">
            Puesto asignado (opcional)
          </label>
          <input
            id="puestoAsignado"
            name="puestoAsignado"
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="telefono" className="mb-1 block text-sm font-medium text-gray-700">
            Teléfono (opcional)
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="cargo" className="mb-1 block text-sm font-medium text-gray-700">
            Cargo (opcional)
          </label>
          <input
            id="cargo"
            name="cargo"
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="fechaVencimientoPase" className="mb-1 block text-sm font-medium text-gray-700">
            Fecha vencimiento pase (opcional)
          </label>
          <input
            id="fechaVencimientoPase"
            name="fechaVencimientoPase"
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="conductorActivo"
            defaultChecked
            className="h-5 w-5 rounded border-gray-300 text-[#005B96] focus:ring-[#005B96]"
          />
          Conductor activo
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Crear usuario
        </button>
      </form>
    </main>
  );
}
