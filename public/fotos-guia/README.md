# Guías visuales de las fotos diarias

Ilustraciones que se muestran en el paso "Fotos del vehículo" para que el
inspector sepa exactamente qué foto se le pide (componente `GuiaFoto`).

- `lateral-moto.webp` / `lateral-carro.svg` -> foto lateral: vehículo completo, de lado.
- `placa-moto.webp` / `placa-carro.svg` -> foto de la placa trasera, en primer plano.

La variante (moto o carro) sale de `Vehicle.tipoVehiculo`; sin tipo se usa moto.

Las de moto son fotos de referencia (WebP 640×360, con marco de visor de
cámara); las de carro siguen siendo ilustraciones propias (SVG, paleta de la
app). Para reemplazar una, conservar el nombre de archivo; si el formato
cambia, ajustar la extensión en `lib/inspections/guia-foto.ts`. Encuadre
horizontal 16:9; las fotos deben pesar como máximo 400 KB
(`test/public-images.test.ts`).
