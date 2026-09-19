"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { crearUsuarioDesdeFormulario } from "@/lib/admin/user-actions";
// `enums` y no `client`: este es un Client Component y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import { Role } from "@/generated/prisma/enums";
import { CamposVehiculo } from "../../_components/CamposVehiculo";
import { UsuarioCreadoPantalla } from "./UsuarioCreadoPantalla";

const ROLES: Role[] = [Role.TRABAJADOR, Role.SUPERVISOR, Role.DIRECTOR, Role.SST, Role.ADMINISTRADOR];

const CLASE_INPUT =
  "w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none";
const CLASE_LABEL = "mb-1 block text-sm font-medium text-gray-700";

// `key` distinto = estado de `useActionState` nuevo: así "Crear otro usuario"
// vuelve a un formulario limpio sin que las credenciales anteriores queden en
// memoria más de lo necesario.
export function NuevoUsuarioForm() {
  const [instancia, setInstancia] = useState(0);
  return <FormularioAlta key={instancia} onCrearOtro={() => setInstancia((n) => n + 1)} />;
}

function FormularioAlta({ onCrearOtro }: { onCrearOtro: () => void }) {
  const [estado, formAction, pendiente] = useActionState(crearUsuarioDesdeFormulario, null);
  // Rol elegido: controla si se muestra la sección de vehículo (solo
  // TRABAJADOR lleva vehículo). Vive acá y no en el <form> para sobrevivir al
  // remontado del formulario tras un error.
  const [rol, setRol] = useState<string>("");

  // El botón de envío queda al final de un formulario largo: se sube para que
  // el error o la pantalla de éxito estén a la vista.
  useEffect(() => {
    if (estado) window.scrollTo({ top: 0 });
  }, [estado]);

  if (estado?.ok) {
    return (
      <UsuarioCreadoPantalla
        name={estado.name}
        email={estado.email}
        password={estado.password}
        role={estado.role}
        placa={estado.placa}
        onCrearOtro={onCrearOtro}
      />
    );
  }

  // Tras un error se repueblan los campos no sensibles; las contraseñas y la
  // foto siempre se vuelven a ingresar.
  const valores = estado ? estado.valores : {};
  const valor = (campo: string) => valores[campo] ?? "";
  const conductorActivo = estado ? valores.conductorActivo === "on" : true;

  return (
    <>
      <div>
        <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">Crear usuario</h1>
      </div>

      {estado && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}

      {/* `key` por error: el remontado garantiza que los campos no controlados
          muestren los valores repoblados tras el reset de formulario de React. */}
      <form
        key={estado ? estado.error : "nuevo"}
        action={formAction}
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="name" className={CLASE_LABEL}>
            Nombre completo
          </label>
          <input id="name" name="name" type="text" required defaultValue={valor("name")} className={CLASE_INPUT} />
        </div>

        <div>
          <label htmlFor="email" className={CLASE_LABEL}>
            Email
          </label>
          <input id="email" name="email" type="email" required defaultValue={valor("email")} className={CLASE_INPUT} />
        </div>

        <div>
          <label htmlFor="password" className={CLASE_LABEL}>
            Contraseña
          </label>
          <input id="password" name="password" type="password" required minLength={8} className={CLASE_INPUT} />
          <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres.</p>
        </div>

        <div>
          <label htmlFor="passwordConfirmacion" className={CLASE_LABEL}>
            Confirmar contraseña
          </label>
          <input
            id="passwordConfirmacion"
            name="passwordConfirmacion"
            type="password"
            required
            minLength={8}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label htmlFor="role" className={CLASE_LABEL}>
            Rol
          </label>
          <select
            id="role"
            name="role"
            required
            value={rol || valor("role")}
            onChange={(e) => setRol(e.target.value)}
            className={CLASE_INPUT}
          >
            <option value="" disabled>
              Selecciona un rol
            </option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cedula" className={CLASE_LABEL}>
            Cédula
          </label>
          <input id="cedula" name="cedula" type="text" defaultValue={valor("cedula")} className={CLASE_INPUT} />
          <p className="mt-1 text-xs text-gray-500">Obligatoria si el rol es Trabajador.</p>
        </div>

        {(rol || valor("role")) === Role.TRABAJADOR && (
          <CamposVehiculo valores={valores} modo="alta" />
        )}

        <div>
          <label htmlFor="puestoAsignado" className={CLASE_LABEL}>
            Puesto asignado (opcional)
          </label>
          <input
            id="puestoAsignado"
            name="puestoAsignado"
            type="text"
            defaultValue={valor("puestoAsignado")}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label htmlFor="telefono" className={CLASE_LABEL}>
            Teléfono (opcional)
          </label>
          <input id="telefono" name="telefono" type="tel" defaultValue={valor("telefono")} className={CLASE_INPUT} />
        </div>

        <div>
          <label htmlFor="cargo" className={CLASE_LABEL}>
            Cargo (opcional)
          </label>
          <input id="cargo" name="cargo" type="text" defaultValue={valor("cargo")} className={CLASE_INPUT} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="conductorActivo"
            defaultChecked={conductorActivo}
            className="h-5 w-5 rounded border-gray-300 text-[#005B96] focus:ring-[#005B96]"
          />
          Conductor activo
        </label>

        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90 disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </>
  );
}
