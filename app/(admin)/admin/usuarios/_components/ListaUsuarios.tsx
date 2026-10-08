"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Role, type Sede } from "@/generated/prisma/enums";
import { ROLES_ASIGNABLES, etiquetaRol, etiquetaSede, etiquetaUsuario } from "@/lib/auth/etiquetas-rol";
import { filtrarUsuarios } from "@/lib/admin/usuario-ui";
import { CLASE_INPUT } from "./ui-formulario";

export type UsuarioDeLista = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sede: Sede | null;
  cedula: string | null;
  cargo: string | null;
  activo: boolean;
  tipoVehiculo: string | null;
  vehicle: { placa: string } | null;
};

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "inactivo", label: "Inactivos" },
];

/**
 * Lista de usuarios en tarjetas con búsqueda y filtros en el navegador (la
 * lista completa ya viene del servidor; son pocas decenas de usuarios).
 * Los valores iniciales vienen de la URL para no romper enlaces existentes.
 */
export function ListaUsuarios({
  usuarios,
  qInicial = "",
  rolInicial = "",
  estadoInicial = "",
}: {
  usuarios: UsuarioDeLista[];
  qInicial?: string;
  rolInicial?: string;
  estadoInicial?: string;
}) {
  const [q, setQ] = useState(qInicial);
  const [rol, setRol] = useState(rolInicial);
  const [estado, setEstado] = useState(estadoInicial);

  const visibles = useMemo(() => filtrarUsuarios(usuarios, { q, rol, estado }), [usuarios, q, rol, estado]);
  const hayFiltros = Boolean(q || rol || estado);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div>
          <label htmlFor="busqueda" className="sr-only">
            Buscar usuarios
          </label>
          <input
            id="busqueda"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, cédula o placa"
            autoComplete="off"
            className={CLASE_INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="filtro-rol" className="mb-1 block text-xs font-medium text-ink-muted">
              Rol
            </label>
            <select id="filtro-rol" value={rol} onChange={(e) => setRol(e.target.value)} className={CLASE_INPUT}>
              <option value="">Todos</option>
              {ROLES_ASIGNABLES.map((r) => (
                <option key={r} value={r}>
                  {etiquetaRol(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado" className="mb-1 block text-xs font-medium text-ink-muted">
              Estado
            </label>
            <select
              id="filtro-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={CLASE_INPUT}
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-ink-muted" aria-live="polite">
          <span>
            {visibles.length} {visibles.length === 1 ? "usuario" : "usuarios"}
          </span>
          {hayFiltros && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setRol("");
                setEstado("");
              }}
              className="min-h-11 px-2 font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
          {hayFiltros ? "No se encontraron usuarios con esos filtros." : "No hay usuarios registrados."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((u) => (
            <TarjetaUsuario key={u.id} usuario={u} />
          ))}
        </ul>
      )}
    </>
  );
}

function TarjetaUsuario({ usuario }: { usuario: UsuarioDeLista }) {
  const esRecorredor = usuario.role === Role.TRABAJADOR;
  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border bg-surface p-3 shadow-sm ${
        usuario.activo ? "border-border" : "border-border opacity-80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{usuario.name}</p>
          <p className="truncate text-sm text-ink-muted">{usuario.email}</p>
        </div>
        <Chip className={usuario.activo ? "bg-status-ok-soft text-status-ok-ink" : "bg-status-crit-soft text-status-crit-ink"}>
          {usuario.activo ? "Activo" : "Inactivo"}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip className="bg-status-info-soft text-status-info-ink">{etiquetaUsuario(usuario.role, usuario.sede)}</Chip>
        {esRecorredor && usuario.sede && (
          <Chip className="bg-status-neutral-soft text-status-neutral-ink">{etiquetaSede(usuario.sede)}</Chip>
        )}
        {usuario.vehicle ? (
          <>
            <span className="rounded-md border border-ink/20 bg-[#fde047] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-ink">
              {usuario.vehicle.placa}
            </span>
            {usuario.tipoVehiculo && (
              <span className="text-xs text-ink-muted">{usuario.tipoVehiculo === "CARRO" ? "Carro" : "Moto"}</span>
            )}
          </>
        ) : (
          esRecorredor && <Chip className="bg-status-warn-soft text-status-warn-ink">Sin vehículo · pendiente de asignación</Chip>
        )}
      </div>

      {(usuario.cedula || usuario.cargo) && (
        <p className="text-xs text-ink-muted">
          {usuario.cedula && <>Cédula {usuario.cedula}</>}
          {usuario.cedula && usuario.cargo && " · "}
          {usuario.cargo}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/admin/usuarios/${usuario.id}/hoja-de-vida`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-border text-sm font-semibold text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Hoja de vida
        </Link>
        <Link
          href={`/admin/usuarios/${usuario.id}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-brand text-sm font-semibold text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Editar
        </Link>
      </div>
    </li>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}
