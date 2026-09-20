import { describe, expect, it, vi } from "vitest";
import {
  CALIDAD_JPEG,
  MAX_LADO_PX,
  UMBRAL_CONSERVAR_BYTES,
  calcularDimensionesDestino,
  comprimirImagen,
  debeConservarOriginal,
  esTipoSoportado,
  nombreJpeg,
  type DependenciasCompresion,
  type ImagenDecodificada,
} from "./compresion-cliente";

// Estos tests cubren SOLO la lógica de decisión (pura, sin DOM). El adaptador
// real de navegador (createImageBitmap + canvas.toBlob, ver
// `adaptador-navegador.ts`) no se puede ejercitar en Node: hay que verificarlo
// a mano en un teléfono real.

const MB = 1024 * 1024;

function archivoFalso(nombre: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo, lastModified: 1_700_000_000_000 });
}

type Fuente = { id: string };

function armarDeps(opciones: {
  ancho: number;
  alto: number;
  bytesResultado?: number | null;
  errorDecodificar?: Error;
  errorCodificar?: Error;
  errorLiberar?: Error;
}) {
  const liberar = vi.fn(() => {
    if (opciones.errorLiberar) throw opciones.errorLiberar;
  });
  const imagen: ImagenDecodificada<Fuente> = {
    ancho: opciones.ancho,
    alto: opciones.alto,
    fuente: { id: "bitmap" },
    liberar,
  };
  const decodificar = vi.fn(async () => {
    if (opciones.errorDecodificar) throw opciones.errorDecodificar;
    return imagen;
  });
  const codificarJpeg = vi.fn(async () => {
    if (opciones.errorCodificar) throw opciones.errorCodificar;
    if (opciones.bytesResultado === null) return null;
    return new Blob([new Uint8Array(opciones.bytesResultado ?? 300_000)], { type: "image/jpeg" });
  });
  const deps: DependenciasCompresion<Fuente> = { decodificar, codificarJpeg };
  return { deps, decodificar, codificarJpeg, liberar, imagen };
}

describe("constantes", () => {
  it("usa 1920 px, calidad 0.8 y umbral de pass-through de 1 MB", () => {
    expect(MAX_LADO_PX).toBe(1920);
    expect(CALIDAD_JPEG).toBe(0.8);
    expect(UMBRAL_CONSERVAR_BYTES).toBe(1 * MB);
  });
});

describe("calcularDimensionesDestino", () => {
  it("reduce una foto horizontal de cámara conservando la proporción", () => {
    expect(calcularDimensionesDestino(4000, 3000, 1920)).toEqual({ ancho: 1920, alto: 1440 });
    expect(calcularDimensionesDestino(4032, 3024, 1920)).toEqual({ ancho: 1920, alto: 1440 });
  });

  it("reduce una foto vertical (el lado largo es el alto)", () => {
    expect(calcularDimensionesDestino(3000, 4000, 1920)).toEqual({ ancho: 1440, alto: 1920 });
  });

  it("reduce una imagen cuadrada", () => {
    expect(calcularDimensionesDestino(4000, 4000, 1920)).toEqual({ ancho: 1920, alto: 1920 });
  });

  it("nunca amplía una imagen que ya es pequeña", () => {
    expect(calcularDimensionesDestino(800, 600, 1920)).toEqual({ ancho: 800, alto: 600 });
    expect(calcularDimensionesDestino(1, 1, 1920)).toEqual({ ancho: 1, alto: 1 });
  });

  it("deja igual una imagen cuyo lado largo es exactamente el límite", () => {
    expect(calcularDimensionesDestino(1920, 1080, 1920)).toEqual({ ancho: 1920, alto: 1080 });
    expect(calcularDimensionesDestino(1080, 1920, 1920)).toEqual({ ancho: 1080, alto: 1920 });
  });

  it("reduce cuando el lado largo excede el límite por 1 px", () => {
    // 1080 * 1920 / 1921 = 1079.44 -> 1079
    expect(calcularDimensionesDestino(1921, 1080, 1920)).toEqual({ ancho: 1920, alto: 1079 });
  });

  it("redondea tamaños impares a enteros", () => {
    const { ancho, alto } = calcularDimensionesDestino(4001, 3001, 1920);
    expect(ancho).toBe(1920);
    expect(Number.isInteger(alto)).toBe(true);
    expect(alto).toBe(1440);
    expect(calcularDimensionesDestino(3999, 2999, 1920)).toEqual({ ancho: 1920, alto: 1440 });
  });

  it("nunca produce un lado menor a 1 px con proporciones extremas", () => {
    expect(calcularDimensionesDestino(10_000, 10, 1920)).toEqual({ ancho: 1920, alto: 2 });
    expect(calcularDimensionesDestino(100_000, 10, 1920)).toEqual({ ancho: 1920, alto: 1 });
    expect(calcularDimensionesDestino(10, 100_000, 1920)).toEqual({ ancho: 1, alto: 1920 });
  });

  it("rechaza dimensiones o límites inválidos", () => {
    expect(() => calcularDimensionesDestino(0, 100, 1920)).toThrow();
    expect(() => calcularDimensionesDestino(100, -5, 1920)).toThrow();
    expect(() => calcularDimensionesDestino(Number.NaN, 100, 1920)).toThrow();
    expect(() => calcularDimensionesDestino(Number.POSITIVE_INFINITY, 100, 1920)).toThrow();
    expect(() => calcularDimensionesDestino(100, 100, 0)).toThrow();
  });
});

describe("nombreJpeg", () => {
  it("reemplaza la extensión existente por .jpg", () => {
    expect(nombreJpeg("IMG_2031.HEIC")).toBe("IMG_2031.jpg");
    expect(nombreJpeg("foto.png")).toBe("foto.jpg");
    expect(nombreJpeg("foto.jpeg")).toBe("foto.jpg");
  });

  it("agrega .jpg si no hay extensión", () => {
    expect(nombreJpeg("foto")).toBe("foto.jpg");
  });

  it("solo reemplaza la última extensión cuando hay varios puntos", () => {
    expect(nombreJpeg("mi.foto.final.webp")).toBe("mi.foto.final.jpg");
  });

  it("maneja punto final, nombre vacío y nombres sin base", () => {
    expect(nombreJpeg("foto.")).toBe("foto.jpg");
    expect(nombreJpeg("")).toBe("foto.jpg");
    expect(nombreJpeg("   ")).toBe("foto.jpg");
    expect(nombreJpeg(".png")).toBe("foto.jpg");
    expect(nombreJpeg(".hidden")).toBe("foto.jpg");
  });
});

describe("esTipoSoportado", () => {
  it("acepta JPEG, PNG y WebP sin importar mayúsculas ni parámetros", () => {
    expect(esTipoSoportado("image/jpeg")).toBe(true);
    expect(esTipoSoportado("image/png")).toBe(true);
    expect(esTipoSoportado("image/webp")).toBe(true);
    expect(esTipoSoportado("IMAGE/JPEG")).toBe(true);
    expect(esTipoSoportado("image/jpeg; charset=binary")).toBe(true);
  });

  it("rechaza HEIC, GIF, vacío y otros tipos", () => {
    expect(esTipoSoportado("image/heic")).toBe(false);
    expect(esTipoSoportado("image/heif")).toBe(false);
    expect(esTipoSoportado("image/gif")).toBe(false);
    expect(esTipoSoportado("")).toBe(false);
    expect(esTipoSoportado("application/pdf")).toBe(false);
  });
});

describe("debeConservarOriginal", () => {
  it("conserva un JPEG/PNG/WebP pequeño y dentro de dimensiones", () => {
    expect(debeConservarOriginal({ tipo: "image/jpeg", bytes: 500_000, ancho: 1600, alto: 1200 })).toBe(true);
    expect(debeConservarOriginal({ tipo: "image/png", bytes: 200_000, ancho: 800, alto: 600 })).toBe(true);
    expect(debeConservarOriginal({ tipo: "image/webp", bytes: 100_000, ancho: 1920, alto: 1080 })).toBe(true);
  });

  it("conserva justo en los umbrales (peso y lado largo)", () => {
    expect(debeConservarOriginal({ tipo: "image/jpeg", bytes: UMBRAL_CONSERVAR_BYTES, ancho: 1920, alto: 1080 })).toBe(true);
  });

  it("no conserva si pasa el umbral de peso por 1 byte", () => {
    expect(debeConservarOriginal({ tipo: "image/jpeg", bytes: UMBRAL_CONSERVAR_BYTES + 1, ancho: 1000, alto: 1000 })).toBe(false);
  });

  it("no conserva si el lado largo excede el máximo, aunque pese poco", () => {
    expect(debeConservarOriginal({ tipo: "image/jpeg", bytes: 200_000, ancho: 1921, alto: 100 })).toBe(false);
    expect(debeConservarOriginal({ tipo: "image/jpeg", bytes: 200_000, ancho: 100, alto: 4000 })).toBe(false);
  });

  it("no conserva tipos no soportados por el servidor, aunque sean pequeños (HEIC)", () => {
    expect(debeConservarOriginal({ tipo: "image/heic", bytes: 100_000, ancho: 800, alto: 600 })).toBe(false);
    expect(debeConservarOriginal({ tipo: "", bytes: 100_000, ancho: 800, alto: 600 })).toBe(false);
  });
});

describe("comprimirImagen", () => {
  it("comprime una foto grande a JPEG reducida a 1920 px de lado largo", async () => {
    const original = archivoFalso("IMG_0001.HEIC", "image/heic", 6 * MB);
    const { deps, codificarJpeg, decodificar } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: 400_000 });

    const resultado = await comprimirImagen(original, deps);

    expect(decodificar).toHaveBeenCalledWith(original);
    expect(codificarJpeg).toHaveBeenCalledTimes(1);
    expect(codificarJpeg).toHaveBeenCalledWith(expect.objectContaining({ ancho: 4000, alto: 3000 }), 1920, 1440, 0.8);
    expect(resultado).not.toBe(original);
    expect(resultado).toBeInstanceOf(File);
    expect(resultado.type).toBe("image/jpeg");
    expect(resultado.name).toBe("IMG_0001.jpg");
    expect(resultado.size).toBe(400_000);
    expect(resultado.size).toBeLessThan(original.size);
    expect(resultado.lastModified).toBe(original.lastModified);
  });

  it("libera la imagen decodificada tras comprimir", async () => {
    const { deps, liberar } = armarDeps({ ancho: 4000, alto: 3000 });
    await comprimirImagen(archivoFalso("a.jpg", "image/jpeg", 5 * MB), deps);
    expect(liberar).toHaveBeenCalledTimes(1);
  });

  it("no reescala si solo excede el peso pero ya está dentro de 1920 px", async () => {
    const original = archivoFalso("a.jpg", "image/jpeg", 3 * MB);
    const { deps, codificarJpeg } = armarDeps({ ancho: 1920, alto: 1080, bytesResultado: 500_000 });

    const resultado = await comprimirImagen(original, deps);

    expect(codificarJpeg).toHaveBeenCalledWith(expect.anything(), 1920, 1080, 0.8);
    expect(resultado.size).toBe(500_000);
  });

  it("comprime una foto vertical respetando la orientación ya decodificada", async () => {
    const { deps, codificarJpeg } = armarDeps({ ancho: 3000, alto: 4000, bytesResultado: 300_000 });
    await comprimirImagen(archivoFalso("v.jpg", "image/jpeg", 4 * MB), deps);
    expect(codificarJpeg).toHaveBeenCalledWith(expect.anything(), 1440, 1920, 0.8);
  });

  describe("pass-through (devuelve el mismo File sin recomprimir)", () => {
    it("JPEG pequeño y dentro de dimensiones", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 500_000);
      const { deps, codificarJpeg, liberar } = armarDeps({ ancho: 1600, alto: 1200 });

      const resultado = await comprimirImagen(original, deps);

      expect(resultado).toBe(original);
      expect(codificarJpeg).not.toHaveBeenCalled();
      expect(liberar).toHaveBeenCalledTimes(1);
    });

    it("PNG pequeño (p. ej. una captura) y dentro de dimensiones", async () => {
      const original = archivoFalso("a.png", "image/png", 200_000);
      const { deps, codificarJpeg } = armarDeps({ ancho: 800, alto: 600 });
      expect(await comprimirImagen(original, deps)).toBe(original);
      expect(codificarJpeg).not.toHaveBeenCalled();
    });

    it("comprime aunque pese poco si excede 1920 px", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 800_000);
      const { deps, codificarJpeg } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: 300_000 });
      const resultado = await comprimirImagen(original, deps);
      expect(codificarJpeg).toHaveBeenCalledTimes(1);
      expect(resultado).not.toBe(original);
    });

    it("convierte un HEIC pequeño (no soportado por el servidor) en vez de dejarlo pasar", async () => {
      const original = archivoFalso("a.heic", "image/heic", 600_000);
      const { deps, codificarJpeg } = armarDeps({ ancho: 1600, alto: 1200, bytesResultado: 400_000 });
      const resultado = await comprimirImagen(original, deps);
      expect(codificarJpeg).toHaveBeenCalledTimes(1);
      expect(resultado.type).toBe("image/jpeg");
      expect(resultado.name).toBe("a.jpg");
    });
  });

  describe("fallback: devuelve el File original intacto", () => {
    it("si decodificar lanza (p. ej. HEIC que el navegador no decodifica)", async () => {
      const original = archivoFalso("a.heic", "image/heic", 5 * MB);
      const { deps, codificarJpeg } = armarDeps({ ancho: 0, alto: 0, errorDecodificar: new Error("no se puede decodificar") });

      const resultado = await comprimirImagen(original, deps);

      expect(resultado).toBe(original);
      expect(resultado.type).toBe("image/heic");
      expect(resultado.size).toBe(5 * MB);
      expect(codificarJpeg).not.toHaveBeenCalled();
    });

    it("si las dimensiones decodificadas son inválidas", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 5 * MB);
      const { deps, codificarJpeg, liberar } = armarDeps({ ancho: 0, alto: 3000 });
      expect(await comprimirImagen(original, deps)).toBe(original);
      expect(codificarJpeg).not.toHaveBeenCalled();
      expect(liberar).toHaveBeenCalledTimes(1);
    });

    it("si codificarJpeg lanza (canvas no soportado, sin memoria)", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 5 * MB);
      const { deps, liberar } = armarDeps({ ancho: 4000, alto: 3000, errorCodificar: new Error("canvas") });
      expect(await comprimirImagen(original, deps)).toBe(original);
      expect(liberar).toHaveBeenCalledTimes(1);
    });

    it("si codificarJpeg devuelve null (toBlob falló)", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 5 * MB);
      const { deps, liberar } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: null });
      expect(await comprimirImagen(original, deps)).toBe(original);
      expect(liberar).toHaveBeenCalledTimes(1);
    });

    it("si el resultado NO es menor que el original soportado (mismo tamaño)", async () => {
      const original = archivoFalso("a.jpg", "image/jpeg", 2 * MB);
      const { deps } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: 2 * MB });
      expect(await comprimirImagen(original, deps)).toBe(original);
    });

    it("si el resultado es MAYOR que el original soportado", async () => {
      const original = archivoFalso("a.png", "image/png", 2 * MB);
      const { deps } = armarDeps({ ancho: 1500, alto: 1000, bytesResultado: 3 * MB });
      expect(await comprimirImagen(original, deps)).toBe(original);
    });
  });

  it("si el original es de un tipo no soportado y el JPEG pesa más, igual devuelve el JPEG (el original sería rechazado)", async () => {
    const original = archivoFalso("a.heic", "image/heic", 1_500_000);
    const { deps } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: 2_000_000 });
    const resultado = await comprimirImagen(original, deps);
    expect(resultado).not.toBe(original);
    expect(resultado.type).toBe("image/jpeg");
    expect(resultado.size).toBe(2_000_000);
  });

  it("un fallo al liberar la imagen no invalida el resultado", async () => {
    const original = archivoFalso("a.jpg", "image/jpeg", 5 * MB);
    const { deps } = armarDeps({ ancho: 4000, alto: 3000, bytesResultado: 400_000, errorLiberar: new Error("close") });
    const resultado = await comprimirImagen(original, deps);
    expect(resultado.size).toBe(400_000);
    expect(resultado.type).toBe("image/jpeg");
  });

  it("la imagen decodificada sin `liberar` también funciona", async () => {
    const original = archivoFalso("a.jpg", "image/jpeg", 5 * MB);
    const deps: DependenciasCompresion<Fuente> = {
      decodificar: async () => ({ ancho: 4000, alto: 3000, fuente: { id: "x" } }),
      codificarJpeg: async () => new Blob([new Uint8Array(100_000)], { type: "image/jpeg" }),
    };
    const resultado = await comprimirImagen(original, deps);
    expect(resultado.size).toBe(100_000);
  });
});
