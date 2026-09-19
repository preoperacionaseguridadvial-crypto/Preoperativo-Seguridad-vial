import { describe, expect, it } from "vitest";
import { leerVehiculoDeFormulario } from "@/lib/admin/hoja-de-vida";

// La casilla "Vehículo activo" solo existe en la edición de un usuario que ya
// tiene vehículo. Un checkbox desmarcado no viaja en el FormData, así que un
// campo oculto (`vehiculoActivoEnForm`) avisa que la casilla estaba en el
// formulario: sin él, `activo` queda sin definir y el vehículo no se toca.
describe("leerVehiculoDeFormulario — activo", () => {
  const base = () => {
    const formData = new FormData();
    formData.set("placa", "abc123");
    return formData;
  };

  it("deja `activo` sin definir cuando el formulario no trae la casilla (alta o usuario sin vehículo)", () => {
    expect(leerVehiculoDeFormulario(base()).activo).toBeUndefined();
  });

  it("devuelve true cuando la casilla está marcada", () => {
    const formData = base();
    formData.set("vehiculoActivoEnForm", "1");
    formData.set("vehiculoActivo", "on");

    expect(leerVehiculoDeFormulario(formData).activo).toBe(true);
  });

  it("devuelve false cuando la casilla estaba en el formulario y se desmarcó", () => {
    const formData = base();
    formData.set("vehiculoActivoEnForm", "1");

    expect(leerVehiculoDeFormulario(formData).activo).toBe(false);
  });
});
