import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

// Alta y baja de suscripciones push del usuario autenticado. La validación del
// payload es pura y vive acá para poder probarla sin HTTP.

/** Roles que reciben notificaciones push. */
export const ROLES_CON_NOTIFICACIONES: readonly Role[] = [
  Role.TRABAJADOR,
  Role.SUPERVISOR,
  Role.SUPERVISOR_OLEARIARI,
  Role.SST,
];

const MAX_ENDPOINT = 2048;
const MAX_CLAVE = 512;

export type SuscripcionEntrante = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function esTextoAcotado(valor: unknown, max: number): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= max;
}

function esEndpointValido(valor: unknown): valor is string {
  if (!esTextoAcotado(valor, MAX_ENDPOINT)) return false;
  try {
    return new URL(valor).protocol === "https:";
  } catch {
    return false;
  }
}

/** Valida el JSON de `PushSubscription.toJSON()`; `null` si no tiene la forma esperada. */
export function validarSuscripcion(body: unknown): SuscripcionEntrante | null {
  if (typeof body !== "object" || body === null) return null;
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  if (!esEndpointValido(endpoint)) return null;
  if (typeof keys !== "object" || keys === null) return null;
  if (!esTextoAcotado(keys.p256dh, MAX_CLAVE) || !esTextoAcotado(keys.auth, MAX_CLAVE)) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

/** Valida el cuerpo del DELETE (`{ endpoint }`); `null` si no es válido. */
export function validarEndpoint(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { endpoint } = body as { endpoint?: unknown };
  return esEndpointValido(endpoint) ? endpoint : null;
}

/** Guarda (o reasigna al usuario actual) la suscripción de un dispositivo. */
export async function guardarSuscripcion(userId: string, sub: SuscripcionEntrante) {
  await prisma.suscripcionPush.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, ...sub },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth },
  });
}

/** Borra la suscripción del dispositivo, solo si pertenece al usuario. */
export async function eliminarSuscripcion(userId: string, endpoint: string) {
  await prisma.suscripcionPush.deleteMany({ where: { endpoint, userId } });
}
