import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Envío de notificaciones Web Push (VAPID). Es "best effort": la notificación
// nunca puede romper ni demorar la acción de negocio que la origina, así que
// nada de lo que se exporta acá lanza. Sin las tres variables de entorno
// (desarrollo local, tests) el módulo es un no-op.

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  /** Ruta interna a abrir al tocar la notificación. */
  url: string;
  /** Notificaciones con el mismo tag se reemplazan entre sí en el dispositivo. */
  tag?: string;
};

let avisoDeshabilitadoEmitido = false;

function configuracion() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !subject) return null;
  return { publica, privada, subject };
}

/** `true` si están las tres variables VAPID y por lo tanto se puede enviar. */
export function pushConfigurado(): boolean {
  return configuracion() !== null;
}

/**
 * Envía `payload` a todos los dispositivos suscritos de `userIds`. Borra las
 * suscripciones que el servicio push da por muertas (404/410); cualquier otro
 * error se registra y se descarta.
 */
export async function enviarAUsuarios(userIds: string[], payload: PayloadPush): Promise<void> {
  try {
    const config = configuracion();
    if (!config) {
      if (!avisoDeshabilitadoEmitido) {
        avisoDeshabilitadoEmitido = true;
        console.warn("[push] Notificaciones deshabilitadas: faltan variables VAPID.");
      }
      return;
    }
    if (userIds.length === 0) return;

    webpush.setVapidDetails(config.subject, config.publica, config.privada);

    const suscripciones = await prisma.suscripcionPush.findMany({
      where: { userId: { in: userIds } },
    });
    const cuerpo = JSON.stringify(payload);

    const resultados = await Promise.allSettled(
      suscripciones.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo),
      ),
    );

    const muertas: string[] = [];
    resultados.forEach((resultado, i) => {
      if (resultado.status === "fulfilled") return;
      const statusCode = (resultado.reason as { statusCode?: number } | null)?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        muertas.push(suscripciones[i].endpoint);
      } else {
        console.error("[push] Falló el envío de una notificación", resultado.reason);
      }
    });

    if (muertas.length > 0) {
      await prisma.suscripcionPush.deleteMany({ where: { endpoint: { in: muertas } } });
    }
  } catch (error) {
    console.error("[push] Error inesperado enviando notificaciones", error);
  }
}
