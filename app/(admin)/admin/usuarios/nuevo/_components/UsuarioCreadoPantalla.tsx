"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Copiable = "email" | "password" | "todo";

const MS_AVISO_COPIADO = 2000;

// `navigator.clipboard` solo existe en contextos seguros (https o localhost);
// la app también se abre por IP de red local en http, de ahí el fallback con
// un textarea temporal y `execCommand`.
async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Permiso denegado: se intenta el fallback.
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copiado = document.execCommand("copy");
    document.body.removeChild(area);
    return copiado;
  } catch {
    return false;
  }
}

/**
 * Pantalla de confirmación tras crear un usuario. Es la única vez que se ve la
 * contraseña: en la base solo queda su hash y no viaja por URL ni por audit.
 */
export function UsuarioCreadoPantalla({
  name,
  email,
  password,
  role,
  placa,
  onCrearOtro,
}: {
  name: string;
  email: string;
  password: string;
  role: string;
  /** Placa del vehículo creado junto con el usuario (solo TRABAJADOR). */
  placa: string | null;
  onCrearOtro: () => void;
}) {
  const [copiado, setCopiado] = useState<Copiable | null>(null);
  const [aviso, setAviso] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  async function copiar(que: Copiable, texto: string) {
    const exito = await copiarAlPortapapeles(texto);
    clearTimeout(temporizador.current);
    setCopiado(exito ? que : null);
    setAviso(exito ? "Copiado al portapapeles." : "No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    temporizador.current = setTimeout(() => {
      setCopiado(null);
      setAviso("");
    }, MS_AVISO_COPIADO);
  }

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <Image
        src="/logo/ess-ltda.png"
        alt="ESS LTDA"
        width={140}
        height={158}
        className="h-16 w-auto object-contain"
        priority
      />

      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Usuario creado</h1>
        <p className="mt-1 text-sm text-gray-600">
          {name} · <span className="font-mono text-xs">{role}</span>
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-md border border-[#D9E2EA] bg-white p-4 text-left">
        {placa && (
          <p className="text-sm text-gray-600">
            Vehículo asignado: <span className="font-mono font-semibold text-[#0B3B60]">{placa}</span>
          </p>
        )}
        <h2 className="text-sm font-medium text-gray-500">Credenciales de acceso</h2>
        <FilaCredencial
          id="credencial-email"
          etiqueta="Email"
          valor={email}
          copiado={copiado === "email"}
          onCopiar={() => copiar("email", email)}
        />
        <FilaCredencial
          id="credencial-password"
          etiqueta="Contraseña"
          valor={password}
          copiado={copiado === "password"}
          onCopiar={() => copiar("password", password)}
        />
        <button
          type="button"
          onClick={() => copiar("todo", `Email: ${email}\nContraseña: ${password}`)}
          className="w-full rounded-md bg-[#0B3B60] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          {copiado === "todo" ? "Copiado" : "Copiar credenciales"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-green-700">
        {aviso}
      </p>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Copia y entrega estas credenciales ahora: la contraseña no se volverá a mostrar. Si se
        pierde, hay que restablecerla desde la edición del usuario.
      </p>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onCrearOtro}
          className="w-full rounded-md border border-[#0B3B60] px-4 py-3 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
        >
          Crear otro usuario
        </button>
        <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
          Volver a usuarios
        </Link>
      </div>
    </section>
  );
}

function FilaCredencial({
  id,
  etiqueta,
  valor,
  copiado,
  onCopiar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={valor}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 select-all rounded-md border border-gray-300 bg-gray-50 px-3 py-3 font-mono text-base text-[#0B3B60] focus:border-[#005B96] focus:outline-none"
        />
        <button
          type="button"
          onClick={onCopiar}
          className="shrink-0 rounded-md border border-[#0B3B60] px-4 py-3 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
