# Fotos de referencia del checklist

Esta carpeta debe contener las fotos reales de las motos de ESS LTDA que se
muestran al trabajador en cada pantalla del checklist, para que asocie
visualmente sobre qué parte de la moto se le está preguntando.

Mientras un archivo no exista, la pantalla muestra automáticamente
`_placeholder.svg` (ver componente `ImagenReferencia`) — no rompe la UI.

## Formato esperado

- Nombre de archivo exacto (minúsculas, kebab-case), extensión `.jpg`.
- Encuadre horizontal o cuadrado, la parte de la moto bien centrada y visible.
- Sacadas a una de las motos reales de ESS LTDA (no fotos de stock).

## Archivos esperados (catálogo FO-SVS-23)

### Checklist — Inspección Visual
- `luces-altas.png` → Luces Altas y Bajas (1/2)
- `luces-bajas.jpg` → Luces Altas y Bajas (2/2)
- `direccionales.jpg` → Direccionales y Estacionarias (1/2)
- `luces-estacionarias.jpg` → Direccionales y Estacionarias (2/2)
- `luz-reversa.jpg` → Luz de Reversa
- `espejos.jpg` → Espejos en buen estado
- `llantas.jpg` → Llantas en buen estado
- `carroceria-latoneria.jpg` → Estado de la latonería / Rayones (misma foto para ambos ítems)

- `frenos.jpg` → Frenos
- `casco.jpg` → Casco (MOTO)

### Checklist — Fluidos
- `nivel-aceite.jpg` → Nivel de aceite
- `nivel-liquido-frenos.jpg` → Nivel líquido de frenos
- `nivel-refrigerante.jpg` → Nivel refrigerante

### Checklist — Equipo de prevención
- `canguro-emergencia.jpg` → Canguro de emergencia vial (MOTO)

### Imágenes para CARRO (formato WebP)

Las preguntas compartidas con moto tienen una imagen aparte para carro
(`ChecklistItem.imagenesCarroUrl`, se muestra solo si el vehículo es CARRO):
- `espejos-carro.webp` → Espejos
- `frenos-carro.webp` → Frenos
- `nivel-aceite-carro.webp`, `nivel-liquido-frenos-carro.webp` y
  `nivel-refrigerante-carro.webp` → Fluidos
- `kilometraje-carro.webp` → pantalla de kilometraje (el de moto es
  `kilometraje.png`)

Las preguntas exclusivas de CARRO usan su imagen como imagen principal:
- `luces-carro.webp` → Luces altas, bajas, reversa e internas con direccionales
- `llantas-repuesto.webp` → Llantas, incluye repuesto
- `cinturones-seguridad.webp`, `limpiabrisas.webp`, `botiquin.webp` y
  `extintor.webp`

La declaración del conductor usa sus propias ilustraciones en
`public/estado-conductor/` (`medicamentos.jpg`, `condiciones-aptas.jpg` y
`alcohol.jpg`, una por pregunta).

### Checklist — Documentación

Sin foto de referencia en el formato oficial (10 ítems: SOAT, Cédula de
ciudadanía, Carné de la compañía, Tarjeta de propiedad, Credencial SSP,
Licencia de conducción vigente, Carné ARL, Carné EPS, Copia parafiscales mes
en curso, Copia salvoconducto autenticada) — la UI cae directo al
`_placeholder.svg`.

### Medidas directas de la inspección (no son ChecklistItem)
- `kilometraje.png` → Kilometraje (odómetro)

## Guía visual interactiva (infográfico completo)

- `moto-guia-inspeccion.png` → imagen única con la moto ESS LTDA y las 12
  zonas numeradas (11 ítems interactivos + 1 medida), usada por el
  componente `MotoInteractiva`. Mientras no exista, cae al mismo
  `_placeholder.svg`. Las coordenadas de cada hotspot son una estimación
  inicial (constante `HOTSPOTS` en `MotoInteractiva.tsx`) — hay que
  ajustarlas mirando la imagen real una vez subida acá.
