"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { crearUsuarioDesdeFormulario } from "@/lib/admin/user-actions";
import { BarraEnvio, ResumenError } from "../../_components/ui-formulario";
import { SeccionesUsuario } from "../../_components/SeccionesUsuario";
import { UsuarioCreadoPantalla } from "./UsuarioCreadoPantalla";

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
  const conductorActivo = estado ? valores.conductorActivo === "on" : true;

  return (
    <>
      <div>
        <Link
          href="/admin/usuarios"
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
        >
          ← Usuarios
        </Link>
        <h1 className="text-xl font-semibold text-ink">Crear usuario</h1>
        <p className="text-sm text-ink-muted">Completa las secciones y guarda al final.</p>
      </div>

      {estado && <ResumenError mensaje={estado.error} />}

      {/* `key` por error: el remontado garantiza que los campos no controlados
          muestren los valores repoblados tras el reset de formulario de React. */}
      <form
        key={estado ? estado.error : "nuevo"}
        action={formAction}
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        <SeccionesUsuario
          modo="alta"
          valores={valores}
          rol={rol || (valores.role ?? "")}
          onRolChange={setRol}
          conductorActivo={conductorActivo}
        />
        <BarraEnvio pendiente={pendiente} texto="Crear usuario" textoPendiente="Creando…" />
      </form>
    </>
  );
}
