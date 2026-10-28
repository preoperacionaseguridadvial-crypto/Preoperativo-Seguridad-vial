// Lógica pura (sin DOM ni servidor) del botón "Activar notificaciones": decide
// qué estado mostrar y convierte la clave VAPID. Vive aparte del componente
// para poder probarla en Node.

export type EstadoNotificaciones =
  | "oculto" // sin clave VAPID pública: la función no está configurada
  | "ios-sin-instalar" // iPhone/iPad: solo funciona con la app agregada a la pantalla de inicio
  | "no-soportado"
  | "bloqueadas" // el usuario negó el permiso en el navegador/teléfono
  | "activas"
  | "inactivas"; // se puede activar

export type EntradaEstado = {
  clavePublica: string | undefined;
  /** Hay `serviceWorker`, `PushManager` y `Notification`. */
  soportado: boolean;
  esIos: boolean;
  /** La app corre instalada (display-mode standalone). */
  standalone: boolean;
  permiso: NotificationPermission | null;
  /** Este dispositivo ya tiene una PushSubscription. */
  suscrito: boolean;
};

/** iPhone/iPad, incluido iPadOS que se anuncia como Mac con pantalla táctil. */
export function esDispositivoIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function derivarEstado(e: EntradaEstado): EstadoNotificaciones {
  if (!e.clavePublica) return "oculto";
  // En iOS fuera de la app instalada Safari ni siquiera expone PushManager:
  // se chequea antes que `soportado` para dar la pista útil.
  if (e.esIos && !e.standalone) return "ios-sin-instalar";
  if (!e.soportado) return "no-soportado";
  if (e.permiso === "denied") return "bloqueadas";
  if (e.permiso === "granted" && e.suscrito) return "activas";
  return "inactivas";
}

/** Convierte la clave pública VAPID (base64url) al formato de `applicationServerKey`. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
