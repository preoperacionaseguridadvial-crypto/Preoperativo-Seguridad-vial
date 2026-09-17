"use server";

import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/requireRole";
import { Role, Prisma, TipoVehiculo } from "@/generated/prisma/client";

// Server actions del panel de administración (Administrador): crear/editar
// usuarios de cualquier rol y restablecer contraseñas. Ningún usuario se
// borra nunca (mismo principio de inmutabilidad que ya rige inspecciones) —
// se desactiva con `activo`. La contraseña nunca viaja a `logAudit`, ni
// hasheada ni en texto plano — el audit log solo registra QUE se restableció,
// nunca el valor.

const COSTO_BCRYPT = 10;

function esErrorEmailDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
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
  fechaVencimientoPase?: Date;
  conductorActivo?: boolean;
}) {
  const session = await requireRole([Role.ADMINISTRADOR]);

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
  if (data.role === Role.TRABAJADOR) {
    if (!cedulaLimpia) {
      throw new Error("La cédula es obligatoria para un trabajador.");
    }
    if (!data.tipoVehiculo) {
      throw new Error("El tipo de vehículo es obligatorio para un trabajador.");
    }
  }

  const passwordHash = await bcrypt.hash(data.password, COSTO_BCRYPT);

  let usuario;
  try {
    usuario = await prisma.user.create({
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
        fechaVencimientoPase: data.fechaVencimientoPase ?? null,
        conductorActivo: data.conductorActivo ?? true,
      },
    });
  } catch (err) {
    if (esErrorEmailDuplicado(err)) {
      throw new Error("Ya existe un usuario con ese email.");
    }
    throw err;
  }

  await logAudit({
    userId: session.user.id,
    action: "CREAR_USUARIO",
    entityType: "User",
    entityId: usuario.id,
    metadata: { role: data.role, email: usuario.email },
  });

  return usuario;
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
    fechaVencimientoPase?: Date | null;
    conductorActivo?: boolean;
  },
) {
  const session = await requireRole([Role.ADMINISTRADOR]);

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

  let usuario;
  try {
    usuario = await prisma.user.update({
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
        fechaVencimientoPase: data.fechaVencimientoPase ?? null,
        conductorActivo: data.conductorActivo ?? true,
      },
    });
  } catch (err) {
    if (esErrorEmailDuplicado(err)) {
      throw new Error("Ya existe un usuario con ese email.");
    }
    throw err;
  }

  await logAudit({
    userId: session.user.id,
    action: "ACTUALIZAR_USUARIO",
    entityType: "User",
    entityId: userId,
    metadata: { role: data.role, activo: data.activo },
  });

  return usuario;
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
  const session = await requireRole([Role.ADMINISTRADOR]);

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
