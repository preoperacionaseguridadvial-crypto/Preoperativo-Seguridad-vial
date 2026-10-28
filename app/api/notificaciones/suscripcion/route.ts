import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  ROLES_CON_NOTIFICACIONES,
  eliminarSuscripcion,
  guardarSuscripcion,
  validarEndpoint,
  validarSuscripcion,
} from "@/lib/notificaciones/suscripciones";

// La autorización se revalida en cada request (sin Full Route Cache).
export const dynamic = "force-dynamic";

async function sesionPermitida() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (!ROLES_CON_NOTIFICACIONES.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Su rol no recibe notificaciones." }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Registra (o reasigna al usuario actual) la suscripción push de este dispositivo. */
export async function POST(request: Request) {
  const sesion = await sesionPermitida();
  if (sesion.error) return sesion.error;

  const suscripcion = validarSuscripcion(await leerJson(request));
  if (!suscripcion) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }

  await guardarSuscripcion(sesion.userId, suscripcion);
  return NextResponse.json({ ok: true });
}

/** Quita la suscripción push de este dispositivo. */
export async function DELETE(request: Request) {
  const sesion = await sesionPermitida();
  if (sesion.error) return sesion.error;

  const endpoint = validarEndpoint(await leerJson(request));
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint inválido." }, { status: 400 });
  }

  await eliminarSuscripcion(sesion.userId, endpoint);
  return NextResponse.json({ ok: true });
}
