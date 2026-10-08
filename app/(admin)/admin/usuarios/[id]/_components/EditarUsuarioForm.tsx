"use client";

import { useState } from "react";
import { SeccionesUsuario } from "../../_components/SeccionesUsuario";
import { BarraEnvio } from "../../_components/ui-formulario";

/**
 * Formulario de edición: mismas secciones que el alta. Es Client Component
 * solo para saber qué rol está elegido (decide si se ve el vehículo); la
 * server action de guardado llega por `action` y el contrato FormData no cambia.
 */
export function EditarUsuarioForm({
  action,
  valores,
  rolInicial,
  conductorActivo,
  usuarioActivo,
  fotoActualUrl,
  vehiculoActivo,
  cedulaPendiente,
  vehiculoPendiente,
}: {
  action: (formData: FormData) => void | Promise<void>;
  valores: Record<string, string>;
  rolInicial: string;
  conductorActivo: boolean;
  usuarioActivo: boolean;
  fotoActualUrl: string | null;
  vehiculoActivo: boolean | undefined;
  cedulaPendiente: boolean;
  vehiculoPendiente: boolean;
}) {
  const [rol, setRol] = useState(rolInicial);

  return (
    <form action={action} encType="multipart/form-data" className="flex flex-col gap-4">
      <SeccionesUsuario
        modo="edicion"
        valores={valores}
        rol={rol}
        onRolChange={setRol}
        conductorActivo={conductorActivo}
        edicion={{
          fotoActualUrl,
          vehiculoActivo,
          usuarioActivo,
          cedulaPendiente: cedulaPendiente && rol === rolInicial,
          vehiculoPendiente,
        }}
      />
      <BarraEnvio texto="Guardar cambios" textoPendiente="Guardando…" />
    </form>
  );
}
