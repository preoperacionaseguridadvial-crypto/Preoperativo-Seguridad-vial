import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TerminosPage from "@/app/(legal)/terminos/page";
import PrivacidadPage from "@/app/(legal)/privacidad/page";

describe("Términos y licencia", () => {
  const html = renderToStaticMarkup(createElement(TerminosPage));

  it("declara la autoría de Histech y la licencia exclusiva de ESS LTDA", () => {
    expect(html).toContain("Histech");
    expect(html).toContain("ESS LTDA");
    expect(html).toContain("licencia de uso");
  });

  it("indica a otras empresas que deben contactar a Histech", () => {
    expect(html).toContain('href="https://histech.com.co/"');
    expect(html).toContain("activación");
  });
});

describe("Política de tratamiento de datos personales", () => {
  const html = renderToStaticMarkup(createElement(PrivacidadPage));

  it("se apoya en la Ley 1581 de 2012 e identifica responsable y encargado", () => {
    expect(html).toContain("Ley 1581 de 2012");
    expect(html).toContain("Responsable del tratamiento");
    expect(html).toContain("Encargado del tratamiento");
  });

  it("trata como datos sensibles las declaraciones de salud y alcohol", () => {
    expect(html).toContain("datos sensibles");
    expect(html).toContain("alcohol");
    expect(html).toContain("medicamentos");
  });

  it("explica los derechos del titular y la queja ante la SIC", () => {
    expect(html).toContain("Derechos del titular");
    expect(html).toContain("Superintendencia de Industria y Comercio");
  });
});
