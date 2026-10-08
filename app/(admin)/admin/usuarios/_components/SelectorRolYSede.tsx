"use client";

import { useState, type ReactNode } from "react";
// `enums` y no `client`: este es un Client Component y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import type { Role } from "@/generated/prisma/enums";
import { ROLES_ASIGNABLES, SEDES, etiquetaRol } from "@/lib/auth/etiquetas-rol";
import { descripcionRol, llevaVehiculo } from "@/lib/admin/usuario-ui";
import { Segmentado } from "./ui-formulario";

const ICONO_ROL: Record<Role, ReactNode> = {
  TRABAJADOR: (
    <path d="M5.5 16.5a3 3 0 100 .01M18.5 16.5a3 3 0 100 .01M5.5 16.5l4-6h5l4 6M14.5 10.5l-1.5-4h2.5" />
  ),
  SUPERVISOR_OLEARIARI: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" />,
  SUPERVISOR: <path d="M4 5h16v11H4zM8 20h8M12 16v4M8 10h8" />,
  DIRECTOR: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z" />,
  SST: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM12 8v6M9 11h6" />,
  ADMINISTRADOR: <path d="M4 7h16M4 12h16M4 17h16M9 5v4M15 10v4M8 15v4" />,
};

/**
 * Sección "Tipo de usuario": tarjetas grandes de rol (radios reales con
 * `name="role"`) y, solo para Recorredor, la sede como opción segmentada
 * (`name="sede"`). La sede es obligatoria únicamente para el Recorredor; para
 * cualquier otro rol no se envía y el servidor guarda null. El servidor
 * revalida (lib/admin/user-actions.ts): esto es solo comodidad.
 */
export function SelectorRolYSede({
  rol,
  onRolChange,
  sedeInicial = "",
}: {
  rol: string;
  onRolChange: (rol: string) => void;
  sedeInicial?: string;
}) {
  const [sede, setSede] = useState(sedeInicial);

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Tipo de usuario</legend>
        <div className="grid gap-2">
          {ROLES_ASIGNABLES.map((r) => (
            <label
              key={r}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors has-[:checked]:border-brand has-[:checked]:bg-status-info-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40"
            >
              <input
                type="radio"
                name="role"
                value={r}
                required
                checked={rol === r}
                onChange={() => onRolChange(r)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-status-neutral-soft text-status-neutral-ink peer-checked:bg-brand peer-checked:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONO_ROL[r]}
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{etiquetaRol(r)}</span>
                <span className="block text-xs text-ink-muted">{descripcionRol(r)}</span>
              </span>
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-full border-2 border-border peer-checked:border-[6px] peer-checked:border-brand"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {llevaVehiculo(rol) && (
        <div>
          <Segmentado
            nombre="sede"
            legenda="Sede"
            requerido
            valor={sede}
            onChange={setSede}
            opciones={SEDES.map((s) => ({ value: s.value, label: s.label }))}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Define quién aprueba sus inspecciones: en Oleariari pasan primero por el Supervisor Oleariari.
          </p>
        </div>
      )}
    </div>
  );
}
