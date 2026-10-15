import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreditoHistech } from "@/app/_components/CreditoHistech";

describe("CreditoHistech", () => {
  const html = renderToStaticMarkup(createElement(CreditoHistech));

  it("muestra el crédito de Histech en una sola línea discreta", () => {
    expect(html).toContain("Todos los derechos reservados");
    expect(html).toContain("Histech");
    expect(html.match(/<p[ >]/g)).toHaveLength(1);
  });

  it("enlaza a la página oficial de Histech en una pestaña nueva", () => {
    expect(html).toContain('href="https://histech.com.co/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("aclara el uso exclusivo de ESS LTDA y enlaza los textos legales", () => {
    expect(html).toContain("ESS LTDA");
    expect(html).toContain('href="/terminos"');
    expect(html).toContain('href="/privacidad"');
  });

  it("muestra «Histech» en el morado de su marca", () => {
    expect(html).toContain("text-[#7C3AED]");
  });
});
