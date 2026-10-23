// Resumen del estado de documentos de vehículos para el inicio del SST:
// recibe cuántos vehículos activos tienen SOAT o tecnomecánica vencidos o por
// vencer (ver getVehiculosConDocumentosPorVencer) y arma el texto de la tarjeta.

export type ResumenDocumentosVehiculos = { alDia: boolean; texto: string };

export function resumenDocumentosVehiculos(vehiculosPorAtender: number): ResumenDocumentosVehiculos {
  if (vehiculosPorAtender <= 0) {
    return { alDia: true, texto: "Todos los SOAT y tecnomecánicas están al día." };
  }
  const vehiculos = vehiculosPorAtender === 1 ? "vehículo" : "vehículos";
  return { alDia: false, texto: `${vehiculosPorAtender} ${vehiculos} con documentos vencidos o por vencer` };
}
