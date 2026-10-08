# Guías visuales de las fotos diarias

Ilustraciones que se muestran en el paso "Fotos del vehículo" para que el
inspector sepa exactamente qué foto se le pide (componente `GuiaFoto`).

- `lateral-moto.svg` / `lateral-carro.svg` -> foto lateral: vehículo completo, de lado.
- `placa-moto.svg` / `placa-carro.svg` -> foto de la placa trasera, en primer plano.

La variante (moto o carro) sale de `Vehicle.tipoVehiculo`; sin tipo se usa moto.

Son ilustraciones propias (paleta de la app, marco de visor de cámara). Se
pueden reemplazar más adelante por fotos reales de ESS LTDA conservando los
mismos nombres de archivo (si el formato cambia, ajustar la extensión en
`lib/inspections/guia-foto.ts`). Encuadre horizontal 16:9.
