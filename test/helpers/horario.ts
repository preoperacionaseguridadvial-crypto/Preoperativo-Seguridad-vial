import { vi } from "vitest";

// Instante dentro de la ventana del turno 1 (06:00 en Bogotá). Los tests que
// llaman acciones del trabajador congelan solo `Date` en este instante para no
// depender de la hora real. Está en el pasado a propósito: el `startedAt` que
// pone la base por default (`now()` real) queda siempre >= al inicio de la
// ventana simulada.
export const HORA_EN_VENTANA = new Date("2026-01-15T11:00:00Z");

export function fijarHoraEnVentana() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HORA_EN_VENTANA);
}

export function restaurarHora() {
  vi.useRealTimers();
}
