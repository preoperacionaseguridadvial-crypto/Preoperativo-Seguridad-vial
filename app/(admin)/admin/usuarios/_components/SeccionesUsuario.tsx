"use client";

import { llevaVehiculo } from "@/lib/admin/usuario-ui";
import { CamposVehiculo } from "./CamposVehiculo";
import { SelectorRolYSede } from "./SelectorRolYSede";
import { CLASE_INPUT, Campo, CampoPassword, Interruptor, Seccion } from "./ui-formulario";

/**
 * Secciones del formulario de usuario, compartidas por el alta y la edición
 * para que se vean y se comporten igual. Solo renderiza campos (los `name` son
 * los del contrato FormData de las server actions); el <form>, el botón de
 * envío y los errores los pone quien lo usa.
 */
export function SeccionesUsuario({
  modo,
  valores,
  rol,
  onRolChange,
  conductorActivo,
  edicion,
}: {
  modo: "alta" | "edicion";
  /** Valores iniciales por nombre de campo (repoblado tras un error, o los del usuario). */
  valores: Record<string, string>;
  rol: string;
  onRolChange: (rol: string) => void;
  conductorActivo: boolean;
  /** Solo edición: datos propios de un usuario ya existente. */
  edicion?: {
    fotoActualUrl: string | null;
    vehiculoActivo: boolean | undefined;
    usuarioActivo: boolean;
    cedulaPendiente: boolean;
    vehiculoPendiente: boolean;
  };
}) {
  const valor = (campo: string) => valores[campo] ?? "";
  const esAlta = modo === "alta";
  const conVehiculo = llevaVehiculo(rol);
  // Numeración dinámica: la sección de vehículo solo cuenta si aplica.
  let n = 0;
  const siguiente = () => ++n;

  return (
    <>
      <Seccion
        numero={siguiente()}
        titulo="Tipo de usuario"
        ayuda="Elige el rol: define qué puede hacer en la app y qué datos se piden."
      >
        <SelectorRolYSede rol={rol} onRolChange={onRolChange} sedeInicial={valor("sede")} />
      </Seccion>

      <Seccion numero={siguiente()} titulo="Datos personales" ayuda="Quién es la persona.">
        <Campo id="name" etiqueta="Nombre completo">
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="off"
            defaultValue={valor("name")}
            className={CLASE_INPUT}
          />
        </Campo>
        <Campo
          id="cedula"
          etiqueta="Cédula"
          opcional={!conVehiculo}
          ayuda={conVehiculo ? "Obligatoria para el Recorredor." : undefined}
        >
          <input
            id="cedula"
            name="cedula"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={valor("cedula")}
            className={CLASE_INPUT}
          />
          {edicion?.cedulaPendiente && (
            <p className="mt-1 text-xs font-medium text-status-warn-ink">Pendiente de asignación.</p>
          )}
        </Campo>
        <Campo id="telefono" etiqueta="Teléfono" opcional>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="off"
            defaultValue={valor("telefono")}
            className={CLASE_INPUT}
          />
        </Campo>
        <Campo id="cargo" etiqueta="Cargo" opcional>
          <input id="cargo" name="cargo" type="text" defaultValue={valor("cargo")} className={CLASE_INPUT} />
        </Campo>
        <Campo id="puestoAsignado" etiqueta="Puesto asignado" opcional>
          <input
            id="puestoAsignado"
            name="puestoAsignado"
            type="text"
            defaultValue={valor("puestoAsignado")}
            className={CLASE_INPUT}
          />
        </Campo>
      </Seccion>

      <Seccion
        numero={siguiente()}
        titulo="Acceso a la app"
        ayuda={esAlta ? "Con estos datos la persona inicia sesión." : "Correo con el que la persona inicia sesión."}
      >
        <Campo id="email" etiqueta="Email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            defaultValue={valor("email")}
            className={CLASE_INPUT}
          />
        </Campo>
        {esAlta && (
          <>
            <Campo id="password" etiqueta="Contraseña" ayuda="Mínimo 8 caracteres.">
              <CampoPassword id="password" nombre="password" />
            </Campo>
            <Campo id="passwordConfirmacion" etiqueta="Confirmar contraseña">
              <CampoPassword id="passwordConfirmacion" nombre="passwordConfirmacion" />
            </Campo>
          </>
        )}
      </Seccion>

      {/* En edición el bloque queda montado aunque el rol cambie (solo se
          oculta): así sus valores siguen viajando en el mismo envío, igual que
          antes. En el alta solo se monta para el Recorredor. */}
      {(conVehiculo || !esAlta) && (
        <div hidden={!conVehiculo}>
          <Seccion
            numero={conVehiculo ? siguiente() : 0}
            titulo="Vehículo del recorredor"
            ayuda="Moto o carro con el que hace sus inspecciones."
          >
            {edicion?.vehiculoPendiente && (
              <p className="rounded-lg bg-status-warn-soft px-3 py-2 text-sm font-medium text-status-warn-ink">
                Pendiente de asignación de vehículo: completa los datos del vehículo.
              </p>
            )}
            <CamposVehiculo
              valores={valores}
              modo={modo}
              fotoActualUrl={edicion?.fotoActualUrl}
              activo={edicion?.vehiculoActivo}
            />
          </Seccion>
        </div>
      )}

      <Seccion
        numero={siguiente()}
        titulo="Estado"
        ayuda={esAlta ? "Si puede operar desde el primer día." : "Si el usuario y su conducción están habilitados."}
      >
        <Interruptor
          nombre="conductorActivo"
          titulo="Conductor activo"
          ayuda="Si lo apagas, sus inspecciones muestran una alerta de conductor inactivo."
          defaultChecked={conductorActivo}
        />
        {!esAlta && edicion && (
          <Interruptor
            nombre="activo"
            titulo="Usuario activo"
            ayuda="Apagado, no puede iniciar sesión. El usuario nunca se borra."
            defaultChecked={edicion.usuarioActivo}
          />
        )}
      </Seccion>
    </>
  );
}
