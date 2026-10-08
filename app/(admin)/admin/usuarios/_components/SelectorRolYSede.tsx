"use client";

import { useState } from "react";
// `enums` y no `client`: este es un Client Component y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import { Role } from "@/generated/prisma/enums";
import { ROLES_ASIGNABLES, SEDES, etiquetaRol } from "@/lib/auth/etiquetas-rol";

const CLASE_INPUT =
  "w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none";
const CLASE_LABEL = "mb-1 block text-sm font-medium text-gray-700";

/**
 * Selects de rol y de sede del formulario de usuario (alta y edición). La
 * sede solo aparece —y es obligatoria— cuando el rol es Recorredor
 * (TRABAJADOR); para cualquier otro rol no se envía y el servidor guarda null.
 * El servidor revalida (lib/admin/user-actions.ts): esto es solo comodidad.
 */
export function SelectorRolYSede({
  rolInicial = "",
  sedeInicial = "",
  conPlaceholder = false,
  onRolChange,
}: {
  rolInicial?: string;
  sedeInicial?: string;
  /** Alta: el rol arranca sin elegir ("Selecciona un rol"). */
  conPlaceholder?: boolean;
  onRolChange?: (rol: string) => void;
}) {
  const [rol, setRol] = useState(rolInicial);

  return (
    <>
      <div>
        <label htmlFor="role" className={CLASE_LABEL}>
          Rol
        </label>
        <select
          id="role"
          name="role"
          required
          value={rol}
          onChange={(e) => {
            setRol(e.target.value);
            onRolChange?.(e.target.value);
          }}
          className={CLASE_INPUT}
        >
          {conPlaceholder && (
            <option value="" disabled>
              Selecciona un rol
            </option>
          )}
          {ROLES_ASIGNABLES.map((r) => (
            <option key={r} value={r}>
              {etiquetaRol(r)}
            </option>
          ))}
        </select>
      </div>

      {rol === Role.TRABAJADOR && (
        <div>
          <label htmlFor="sede" className={CLASE_LABEL}>
            Sede
          </label>
          <select id="sede" name="sede" required defaultValue={sedeInicial} className={CLASE_INPUT}>
            <option value="" disabled>
              Selecciona una sede
            </option>
            {SEDES.map((sede) => (
              <option key={sede.value} value={sede.value}>
                {sede.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Define quién aprueba sus inspecciones: en Olariari pasan primero por el Supervisor Olariari.
          </p>
        </div>
      )}
    </>
  );
}
