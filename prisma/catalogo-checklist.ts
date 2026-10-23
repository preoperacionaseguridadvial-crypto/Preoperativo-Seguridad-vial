import { TipoVehiculo, TipoRespuestaItem } from "../generated/prisma/client";

// Catálogo REAL del checklist, auditado contra el formato oficial FO-SVS-23
// y autorizado por el dueño de producto — reemplaza al catálogo del Slice 1
// (moto-only, sin fluidos). Reestructuración de la fase soporte-moto-carro
// (Slice 2, A1/A2): cuatro categorías ("Documentación", "Inspección Visual",
// "Fluidos", "Equipo de prevención"), cada ítem branchea por `tipoVehiculo`
// (`undefined` = aplica a MOTO y CARRO) y declara `tipoRespuesta` (por
// defecto BINARIO; TRIESTADO para los 3 ítems de fluidos).
//
// "Frenos" (el sistema de frenos en sí) es BINARIO y compartido — distinto
// de "Nivel líquido de frenos" (TRIESTADO, Fluidos): confirmado
// explícitamente con el dueño de producto para no confundir los dos ítems.
//
// `orden` de cada ítem es el orden GLOBAL del recorrido guiado (feature
// checklist-bueno-malo, 2026-10-23), no un orden dentro de su categoría: los
// ítems de distintas categorías se intercalan (Luces, Llantas, Aceite, Líquido
// de frenos, Frenos, Refrigerante, Espejos…), y las categorías solo sirven para
// agrupar en el PDF/detalle. La excepción es "Documentación": va SIEMPRE
// primero como una sola lista (`/checklist`) y su `orden` solo ordena la lista.
// Cada tipo de vehículo recorre únicamente sus ítems (los exclusivos de MOTO o
// CARRO se filtran), así que los números pueden repetirse entre tipos. La
// migración 20261023150000_orden_flujo_checklist aplica estos mismos números a
// las bases existentes (hay un test que verifica que coincidan).
//
// "Equipo de prevención" es una categoría compartida conceptualmente, pero
// sus ítems concretos son 100% específicos por tipo: MOTO usa "Canguro de
// emergencia vial", CARRO usa "Botiquín" + "Extintor" — ningún ítem de esta
// categoría tiene `tipoVehiculo: undefined`.
export const CHECKLIST: Array<{
  nombre: string;
  orden: number;
  items: Array<{
    nombre: string;
    orden: number;
    slugs: string[];
    // Imágenes propias para CARRO en preguntas compartidas con moto: si el
    // vehículo es CARRO reemplazan a `slugs` (ver lib/inspections/imagenes.ts).
    slugsCarro?: string[];
    pideUbicacion?: boolean;
    tipoVehiculo?: TipoVehiculo;
    tipoRespuesta?: TipoRespuestaItem;
  }>;
}> = [
  // Recorrido guiado (pedido del dueño de producto, 2026-10-23): kilometraje →
  // Documentación (una sola lista) → ítems por `orden` global → declaración del
  // conductor → fotos → resultado → firma.
  {
    nombre: "Documentación",
    orden: 4,
    items: [
      { nombre: "Tarjeta de propiedad / Licencia de tránsito", orden: 1, slugs: [] },
      { nombre: "SOAT", orden: 2, slugs: [] },
      { nombre: "Revisión técnicomecánica", orden: 3, slugs: [] },
      { nombre: "Licencia de conducción", orden: 4, slugs: [] },
      { nombre: "Cédula de ciudadanía", orden: 5, slugs: [] },
    ],
  },
  {
    nombre: "Inspección Visual",
    orden: 1,
    items: [
      { nombre: "Espejos", orden: 90, slugs: ["espejos"], slugsCarro: ["espejos-carro.webp"] },
      { nombre: "Frenos", orden: 50, slugs: ["frenos"], slugsCarro: ["frenos-carro.webp"] },
      {
        nombre: "Luces externas con direccionales",
        orden: 10,
        slugs: ["direccionales"],
        tipoVehiculo: TipoVehiculo.MOTO,
      },
      { nombre: "Llantas", orden: 20, slugs: ["llantas"], tipoVehiculo: TipoVehiculo.MOTO },
      { nombre: "Casco", orden: 130, slugs: ["casco"], tipoVehiculo: TipoVehiculo.MOTO },
      {
        nombre: "Luces altas, bajas, reversa e internas con direccionales",
        orden: 11,
        slugs: ["luces-carro.webp"],
        tipoVehiculo: TipoVehiculo.CARRO,
      },
      {
        nombre: "Llantas, incluye repuesto",
        orden: 21,
        slugs: ["llantas-repuesto.webp"],
        tipoVehiculo: TipoVehiculo.CARRO,
      },
      { nombre: "Cinturones de seguridad", orden: 70, slugs: ["cinturones-seguridad.webp"], tipoVehiculo: TipoVehiculo.CARRO },
      { nombre: "Limpiabrisas", orden: 80, slugs: ["limpiabrisas.webp"], tipoVehiculo: TipoVehiculo.CARRO },
    ],
  },
  {
    nombre: "Fluidos",
    orden: 2,
    items: [
      {
        nombre: "Nivel de aceite",
        orden: 30,
        slugs: ["nivel-aceite"],
        slugsCarro: ["nivel-aceite-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
      {
        nombre: "Nivel líquido de frenos",
        orden: 40,
        slugs: ["nivel-liquido-frenos"],
        slugsCarro: ["nivel-liquido-frenos-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
      {
        nombre: "Nivel refrigerante",
        orden: 60,
        slugs: ["nivel-refrigerante"],
        slugsCarro: ["nivel-refrigerante-carro.webp"],
        tipoRespuesta: TipoRespuestaItem.TRIESTADO,
      },
    ],
  },
  {
    nombre: "Equipo de prevención",
    orden: 3,
    items: [
      { nombre: "Canguro de emergencia vial", orden: 120, slugs: ["canguro-emergencia"], tipoVehiculo: TipoVehiculo.MOTO },
      { nombre: "Botiquín", orden: 100, slugs: ["botiquin.webp"], tipoVehiculo: TipoVehiculo.CARRO },
      { nombre: "Extintor", orden: 110, slugs: ["extintor.webp"], tipoVehiculo: TipoVehiculo.CARRO },
    ],
  },
];
