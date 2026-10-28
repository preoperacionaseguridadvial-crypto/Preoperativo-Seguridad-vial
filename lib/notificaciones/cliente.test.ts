import { describe, expect, it } from "vitest";
import { derivarEstado, esDispositivoIos, urlBase64ToUint8Array } from "@/lib/notificaciones/cliente";

const BASE = {
  clavePublica: "BClave",
  soportado: true,
  esIos: false,
  standalone: false,
  permiso: "default" as NotificationPermission | null,
  suscrito: false,
};

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url sin relleno, con - y _", () => {
    // bytes 0xfb 0xff 0xfe -> "+//+" en base64 estándar -> "-__-" en base64url
    expect(Array.from(urlBase64ToUint8Array("-__-"))).toEqual([0xfb, 0xff, 0xfe]);
  });

  it("agrega el relleno que falta", () => {
    expect(Array.from(urlBase64ToUint8Array("aGk"))).toEqual([104, 105]); // "hi"
    expect(Array.from(urlBase64ToUint8Array("aA"))).toEqual([104]); // "h"
  });

  it("clave vacía -> arreglo vacío", () => {
    expect(urlBase64ToUint8Array("").length).toBe(0);
  });
});

describe("esDispositivoIos", () => {
  it("detecta iPhone y iPad por user agent", () => {
    expect(esDispositivoIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(esDispositivoIos("Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X)", 5)).toBe(true);
  });

  it("detecta iPadOS que se presenta como Mac con pantalla táctil", () => {
    expect(esDispositivoIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
  });

  it("Mac de escritorio y Android no son iOS", () => {
    expect(esDispositivoIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(esDispositivoIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe(false);
  });
});

describe("derivarEstado", () => {
  it("sin clave VAPID pública: oculto", () => {
    expect(derivarEstado({ ...BASE, clavePublica: undefined })).toBe("oculto");
    expect(derivarEstado({ ...BASE, clavePublica: "" })).toBe("oculto");
  });

  it("iOS sin instalar en pantalla de inicio: pide agregar la app (aunque no haya PushManager)", () => {
    expect(derivarEstado({ ...BASE, esIos: true, standalone: false, soportado: false })).toBe("ios-sin-instalar");
  });

  it("iOS instalado y con soporte: se puede activar", () => {
    expect(derivarEstado({ ...BASE, esIos: true, standalone: true })).toBe("inactivas");
  });

  it("sin soporte del navegador: no soportado", () => {
    expect(derivarEstado({ ...BASE, soportado: false, permiso: null })).toBe("no-soportado");
  });

  it("permiso denegado: bloqueadas", () => {
    expect(derivarEstado({ ...BASE, permiso: "denied" })).toBe("bloqueadas");
  });

  it("permiso concedido y suscripción existente: activas", () => {
    expect(derivarEstado({ ...BASE, permiso: "granted", suscrito: true })).toBe("activas");
  });

  it("permiso concedido pero sin suscripción en este dispositivo: inactivas", () => {
    expect(derivarEstado({ ...BASE, permiso: "granted", suscrito: false })).toBe("inactivas");
  });

  it("permiso aún no pedido: inactivas", () => {
    expect(derivarEstado(BASE)).toBe("inactivas");
  });
});
