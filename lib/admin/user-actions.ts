"use server";

import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, Prisma, TipoVehiculo, type Vehicle } from "@/generated/prisma/client";
import {
  TIPO_DESCRIPTIVO,
  borrarFotoHuerfana,
  hayDatosDeVehiculo,
  intentaCargarHojaDeVida,
  leerVehiculoDeFormulario,
  normalizarPlaca,
  subirFotoVehiculo,
  tieneHojaDeVidaCompleta,
  validarFotoVehiculo,
  validarHojaDeVida,
  type DatosVehiculo,
} from "@/lib/admin/hoja-de-vida";

// Server actions del panel de administración: crear/editar usuarios de
// cualquier rol y restablecer contraseñas. ADMINISTRADOR y SST tienen
// paridad total acá (SST se encarga en la práctica de dar de alta
// trabajadores y resetear contraseñas, tanto como el propio Administrador —
// decisión explícita del usuario, no una restricción a "solo trabajadores").
// Cada TRABAJADOR tiene UN vehículo (1:1, `User.vehicleId`) que se crea y
// edita desde su propio usuario — ya no hay un módulo de vehículos aparte
// (decisión del usuario, 2026-09-18). Ningún usuario se borra nunca (mismo
// principio de inmutabilidad que ya rige inspecciones) — se desactiva con
// `activo`. La contraseña nunca viaja a `logAudit`, ni hasheada ni en texto
// plano — el audit log solo registra QUE se restableció, nunca el valor.

const COSTO_BCRYPT = 10;

/**
 * Qué campo único chocó en un P2002. Antes solo `email` era único; ahora
 * también `Vehicle.placa`, así que se inspecciona el objetivo de la violación
 * (mensaje + meta, cuya forma cambia según el driver). Sin pista de placa se
 * asume email, el comportamiento histórico.
 */
function campoDuplicado(err: unknown): "placa" | "email" | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return null;
  }
  const objetivo = `${err.message} ${JSON.stringify(err.meta ?? {})}`.toLowerCase();
  return objetivo.includes("placa") ? "placa" : "email";
}

function errorDeDuplicado(err: unknown): Error | null {
  const campo = campoDuplicado(err);
  if (campo === "placa") return new Error("Ya existe un vehículo con esa placa.");
  if (campo === "email") return new Error("Ya existe un usuario con ese email.");
  return null;
}

/**
 * Valida el vehículo de un TRABAJADOR que se crea (alta, o completar a un
 * legacy sin vehículo): placa, foto y hoja de vida completa. Todo se valida
 * ANTES de subir nada a S3 para no dejar objetos huérfanos por errores de
 * captura.
 */
function validarVehiculoParaAlta(
  vehiculo: DatosVehiculo | undefined,
  tipoVehiculo: TipoVehiculo | null | undefined,
): { placa: string; foto: File } {
  const placa = normalizarPlaca(vehiculo?.placa);
  if (!placa) {
    throw new Error("La placa es obligatoria para un trabajador.");
  }
  const foto = vehiculo?.foto;
  if (!foto || foto.size === 0) {
    throw new Error("La foto del vehículo es obligatoria para un trabajador.");
  }
  validarHojaDeVida({ tipoVehiculo, ...vehiculo });
  validarFotoVehiculo(foto);
  return { placa, foto };
}

/** Campos de `Vehicle` que salen de la hoja de vida (sin placa ni foto). */
function camposDeHojaDeVida(vehiculo: DatosVehiculo, tipoVehiculo: TipoVehiculo) {
  return {
    tipo: TIPO_DESCRIPTIVO[tipoVehiculo],
    tipoVehiculo,
    marca: vehiculo.marca?.trim() || null,
    modelo: vehiculo.modelo?.trim() || null,
    color: vehiculo.color?.trim() || null,
    fechaVencimientoSoat: vehiculo.fechaVencimientoSoat ?? null,
    fechaVencimientoTecnicomecanica: vehiculo.fechaVencimientoTecnicomecanica ?? null,
  };
}

export async function crearUsuario(data: {
  name: string;
  email: string;
  password: string;
  passwordConfirmacion: string;
  role: Role;
  cedula?: string;
  telefono?: string;
  cargo?: string;
  puestoAsignado?: string;
  tipoVehiculo?: TipoVehiculo;
  // Solo se usa (y se exige) para TRABAJADOR; para el resto de los roles se
  // ignora si llega.
  vehiculo?: DatosVehiculo;
  conductorActivo?: boolean;
}) {
  const session = await requireRole([Role.ADMINISTRADOR, Role.SST]);

  const nombreLimpio = data.name.trim();
  const emailLimpio = data.email.trim().toLowerCase();
  if (!nombreLimpio || !emailLimpio) {
    throw new Error("Nombre y email son obligatorios.");
  }
  if (data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  if (data.password !== data.passwordConfirmacion) {
    throw new Error("Las contraseñas no coinciden.");
  }

  // Fase soporte-moto-carro: cédula y tipoVehiculo son obligatorios SOLO
  // para TRABAJADOR (el resto de los roles no operan vehículos). Usuarios
  // legacy ya creados no se ven afectados — esta validación corre
  // únicamente en el alta, nunca retroactivamente (ver
  // spec: user-administration, "Creando un trabajador sin cédula").
  const cedulaLimpia = data.cedula?.trim() || null;
  let vehiculoValidado: { placa: string; foto: File } | null = null;
  if (data.role === Role.TRABAJADOR) {
    if (!cedulaLimpia) {
      throw new Error("La cédula es obligatoria para un trabajador.");
    }
    if (!data.tipoVehiculo) {
      throw new Error("El tipo de vehículo es obligatorio para un trabajador.");
    }
    vehiculoValidado = validarVehiculoParaAlta(data.vehiculo, data.tipoVehiculo);
  }

  const passwordHash = await bcrypt.hash(data.password, COSTO_BCRYPT);

  // La foto se sube ANTES de escribir (S3 no participa de la transacción de
  // la base): si la escritura falla se borra como acción compensatoria.
  const fotoS3Key = vehiculoValidado
    ? await subirFotoVehiculo(vehiculoValidado.placa, vehiculoValidado.foto)
    : null;

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const vehiculo =
        vehiculoValidado && data.vehiculo && data.tipoVehiculo
          ? await tx.vehicle.create({
              data: {
                placa: vehiculoValidado.placa,
                fotoS3Key,
                ...camposDeHojaDeVida(data.vehiculo, data.tipoVehiculo),
              },
            })
          : null;
      const usuario = await tx.user.create({
        data: {
          name: nombreLimpio,
          email: emailLimpio,
          passwordHash,
          role: data.role,
          cedula: cedulaLimpia,
          telefono: data.telefono?.trim() || null,
          cargo: data.cargo?.trim() || null,
          puestoAsignado: data.puestoAsignado?.trim() || null,
          tipoVehiculo: data.tipoVehiculo ?? null,
          vehicleId: vehiculo?.id ?? null,
          conductorActivo: data.conductorActivo ?? true,
        },
      });
      return { usuario, vehiculo };
    });
  } catch (err) {
    if (fotoS3Key) {
      await borrarFotoHuerfana(fotoS3Key, "crear el usuario");
    }
    throw errorDeDuplicado(err) ?? err;
  }

  const { usuario, vehiculo } = resultado;
  await logAudit({
    userId: session.user.id,
    action: "CREAR_USUARIO",
    entityType: "User",
    entityId: usuario.id,
    // La placa no es sensible (a diferencia de la contraseña, que nunca va).
    metadata: { role: data.role, email: usuario.email, ...(vehiculo && { placa: vehiculo.placa }) },
  });
  if (vehiculo) {
    await logAudit({
      userId: session.user.id,
      action: "CREAR_VEHICULO",
      entityType: "Vehicle",
      entityId: vehiculo.id,
      metadata: { placa: vehiculo.placa },
    });
  }

  return { ...usuario, vehiculo };
}

// Campos del formulario de alta que se devuelven al cliente cuando falla la
// creación, para que no se pierdan al re-renderizar. Las contraseñas y la
// foto NUNCA están acá (la foto hay que volver a elegirla).
const CAMPOS_REPOBLABLES = [
  "name",
  "email",
  "role",
  "cedula",
  "tipoVehiculo",
  "puestoAsignado",
  "telefono",
  "cargo",
  "placa",
  "marca",
  "modelo",
  "color",
  "fechaVencimientoSoat",
  "fechaVencimientoTecnicomecanica",
] as const;

export type CrearUsuarioEstado =
  | { ok: false; error: string; valores: Record<string, string> }
  | {
      ok: true;
      name: string;
      email: string;
      password: string;
      role: Role;
      // Placa del vehículo creado junto con el usuario (solo TRABAJADOR).
      placa: string | null;
    };

/**
 * Adaptador de `crearUsuario` para `useActionState` (pantalla de alta). En
 * éxito devuelve las credenciales para mostrarlas UNA sola vez en el cliente:
 * la contraseña viaja solo en esta respuesta (nunca en la URL ni en
 * `logAudit`) y en la base solo queda su hash. En error devuelve el mensaje
 * en vez de lanzar, para no perder el formulario con una redirección.
 */
export async function crearUsuarioDesdeFormulario(
  _estadoPrevio: CrearUsuarioEstado | null,
  formData: FormData,
): Promise<CrearUsuarioEstado> {
  const texto = (campo: string) => formData.get(campo)?.toString() ?? "";

  try {
    const usuario = await crearUsuario({
      name: texto("name"),
      email: texto("email"),
      password: texto("password"),
      passwordConfirmacion: texto("passwordConfirmacion"),
      role: formData.get("role") as Role,
      cedula: texto("cedula"),
      telefono: texto("telefono"),
      cargo: texto("cargo"),
      puestoAsignado: texto("puestoAsignado"),
      tipoVehiculo: (texto("tipoVehiculo") || undefined) as TipoVehiculo | undefined,
      vehiculo: leerVehiculoDeFormulario(formData),
      conductorActivo: formData.get("conductorActivo") === "on",
    });
    return {
      ok: true,
      name: usuario.name,
      email: usuario.email,
      password: texto("password"),
      role: usuario.role,
      placa: usuario.vehiculo?.placa ?? null,
    };
  } catch (err) {
    const valores: Record<string, string> = Object.fromEntries(
      CAMPOS_REPOBLABLES.map((campo) => [campo, texto(campo)]),
    );
    valores.conductorActivo = formData.get("conductorActivo") === "on" ? "on" : "";
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo crear el usuario.",
      valores,
    };
  }
}

export async function actualizarUsuario(
  userId: string,
  data: {
    name: string;
    email: string;
    role: Role;
    activo: boolean;
    cedula?: string;
    telefono?: string;
    cargo?: string;
    puestoAsignado?: string;
    tipoVehiculo?: TipoVehiculo | null;
    // Solo aplica a TRABAJADOR. `undefined` = no tocar el vehículo.
    vehiculo?: DatosVehiculo;
    conductorActivo?: boolean;
  },
) {
  const session = await requireRole([Role.ADMINISTRADOR, Role.SST]);

  const nombreLimpio = data.name.trim();
  const emailLimpio = data.email.trim().toLowerCase();
  if (!nombreLimpio || !emailLimpio) {
    throw new Error("Nombre y email son obligatorios.");
  }

  // Igual que en `crearUsuario`: solo se exige para TRABAJADOR. Editar un
  // usuario legacy sin completar estos campos sigue permitido para
  // cualquier otro rol (spec: "pendiente de asignación" no bloquea).
  const cedulaLimpia = data.cedula?.trim() || null;
  if (data.role === Role.TRABAJADOR) {
    if (!cedulaLimpia) {
      throw new Error("La cédula es obligatoria para un trabajador.");
    }
    if (!data.tipoVehiculo) {
      throw new Error("El tipo de vehículo es obligatorio para un trabajador.");
    }
  }

  const actual = await prisma.user.findUnique({ where: { id: userId }, include: { vehicle: true } });
  if (!actual) {
    throw new Error("El usuario no existe.");
  }

  // Vehículo del trabajador. Editar uno existente NO vuelve a exigir la foto
  // ni los datos si era un vehículo legacy sin hoja de vida (D4), pero si se
  // intenta cargar CUALQUIER campo se exige que quede completa (no se acepta
  // una hoja de vida a medias). Completar a un trabajador legacy SIN vehículo
  // (o no cargar ninguno) sigue las mismas reglas del alta.
  const vehiculoDatos = data.role === Role.TRABAJADOR ? data.vehiculo : undefined;
  const tipoVehiculo = data.tipoVehiculo ?? undefined;
  let plan:
    | { accion: "actualizar"; placa: string; foto: File | null }
    | { accion: "crear"; placa: string; foto: File }
    | null = null;

  if (vehiculoDatos && tipoVehiculo) {
    if (actual.vehicle) {
      if (tieneHojaDeVidaCompleta(actual.vehicle) || intentaCargarHojaDeVida(vehiculoDatos)) {
        validarHojaDeVida({ tipoVehiculo, ...vehiculoDatos });
      }
      const foto = vehiculoDatos.foto && vehiculoDatos.foto.size > 0 ? vehiculoDatos.foto : null;
      if (foto) validarFotoVehiculo(foto);
      plan = {
        accion: "actualizar",
        placa: normalizarPlaca(vehiculoDatos.placa) || actual.vehicle.placa,
        foto,
      };
    } else if (hayDatosDeVehiculo(vehiculoDatos)) {
      plan = { accion: "crear", ...validarVehiculoParaAlta(vehiculoDatos, tipoVehiculo) };
    }
  }

  const fotoS3Key = plan?.foto ? await subirFotoVehiculo(plan.placa, plan.foto) : null;

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      let vehiculo: Vehicle | null = actual.vehicle;
      if (plan && vehiculoDatos && tipoVehiculo) {
        const campos = camposDeHojaDeVida(vehiculoDatos, tipoVehiculo);
        vehiculo =
          plan.accion === "actualizar"
            ? await tx.vehicle.update({
                where: { id: actual.vehicleId! },
                data: { placa: plan.placa, ...campos, ...(fotoS3Key ? { fotoS3Key } : {}) },
              })
            : await tx.vehicle.create({ data: { placa: plan.placa, fotoS3Key, ...campos } });
      }
      const usuario = await tx.user.update({
        where: { id: userId },
        data: {
          name: nombreLimpio,
          email: emailLimpio,
          role: data.role,
          activo: data.activo,
          cedula: cedulaLimpia,
          telefono: data.telefono?.trim() || null,
          cargo: data.cargo?.trim() || null,
          puestoAsignado: data.puestoAsignado?.trim() || null,
          tipoVehiculo: data.tipoVehiculo ?? null,
          vehicleId: vehiculo?.id ?? null,
          conductorActivo: data.conductorActivo ?? true,
        },
      });
      return { usuario, vehiculo };
    });
  } catch (err) {
    if (fotoS3Key) {
      await borrarFotoHuerfana(fotoS3Key, "actualizar el usuario");
    }
    throw errorDeDuplicado(err) ?? err;
  }

  const { usuario, vehiculo } = resultado;
  await logAudit({
    userId: session.user.id,
    action: "ACTUALIZAR_USUARIO",
    entityType: "User",
    entityId: userId,
    metadata: {
      role: data.role,
      activo: data.activo,
      ...(vehiculo && plan && { placa: vehiculo.placa }),
    },
  });
  if (vehiculo && plan) {
    await logAudit({
      userId: session.user.id,
      action: plan.accion === "crear" ? "CREAR_VEHICULO" : "ACTUALIZAR_VEHICULO",
      entityType: "Vehicle",
      entityId: vehiculo.id,
      metadata: { placa: vehiculo.placa },
    });
  }

  return { ...usuario, vehiculo };
}

/**
 * Restablece la contraseña de un usuario. El admin escribe la contraseña
 * nueva directamente y la comunica por fuera del sistema (no hay
 * infraestructura de email en el proyecto) — la contraseña NUNCA se registra
 * en el audit log, solo el hecho de que se restableció.
 */
export async function restablecerPassword(
  userId: string,
  newPassword: string,
  newPasswordConfirmacion: string,
) {
  const session = await requireRole([Role.ADMINISTRADOR, Role.SST]);

  if (newPassword.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  if (newPassword !== newPasswordConfirmacion) {
    throw new Error("Las contraseñas no coinciden.");
  }

  const passwordHash = await bcrypt.hash(newPassword, COSTO_BCRYPT);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logAudit({
    userId: session.user.id,
    action: "RESTABLECER_PASSWORD",
    entityType: "User",
    entityId: userId,
  });
}
