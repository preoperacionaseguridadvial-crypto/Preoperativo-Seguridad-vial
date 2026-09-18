# Fuente del PDF oficial (FO-SVS-23)

El formato oficial FO-SVS-23 pide Arial Narrow, pero es una fuente
propietaria de Microsoft: no hay archivo redistribuible en este repo ni
licencia de embedding confirmada para el deployment (fase soporte-moto-carro,
decisión D1). En su lugar se bundlean acá los 2 archivos reales de
**Liberation Sans Narrow**, la alternativa libre más estándar,
métricamente compatible con Arial Narrow (mismas métricas de ancho de
carácter — un documento maquetado para Arial Narrow no reflows al
sustituirla).

## Archivos

- `LiberationSansNarrow-Regular.ttf`
- `LiberationSansNarrow-Bold.ttf` (el formato usa texto en negrita en varias
  secciones — ver `lib/pdf/InspeccionPdfDocument.tsx`)

Registrados en `@react-pdf/renderer` vía `lib/pdf/fonts.ts`
(`Font.register`), como familias `"Liberation Sans Narrow"` /
`"Liberation Sans Narrow Bold"`, a 11pt base en todo el documento.

## Origen

Descargados del release oficial del proyecto, tag `1.07.6`:
<https://github.com/liberationfonts/liberation-sans-narrow/releases/tag/1.07.6>

**Nota importante sobre licencia**: Liberation Sans/Serif/Mono (el paquete
"grande", sin variante Narrow) migraron a licencia **SIL Open Font License
1.1** en la versión 2.x del proyecto
(`liberationfonts/liberation-fonts`). La variante **Narrow** vive en un
repositorio aparte (`liberationfonts/liberation-sans-narrow`) que **nunca
migró** y sigue distribuyéndose bajo la EULA original de Red Hat, versión
`1.07.6`:

> "LIBERATION FONT SOFTWARE" — GNU General Public License v2, más una
> excepción explícita de incrustación de fuente (cláusula 1(a)): incrustar
> esta fuente en un documento (como los PDF que genera este sistema) no hace
> que el documento resultante quede bajo GPL. Copyright © 2007-2011 Red Hat,
> Inc. "LIBERATION" es una marca registrada de Red Hat, Inc.

Texto completo de la licencia en el release original (`License.txt` +
`COPYING`, GPLv2 base). Esto es **distinto de SIL OFL**, que fue la
suposición inicial de la propuesta del cambio (`sdd/soporte-moto-carro/proposal`,
D1) — se corrige y documenta acá con precisión porque es una decisión de
licenciamiento, no un detalle de implementación menor. La cláusula de
excepción de embedding cubre exactamente el caso de uso de este proyecto
(incrustar la fuente en PDFs generados), así que el uso es seguro, pero el
compliance real es "GPLv2 + excepción de fuente", no OFL.
