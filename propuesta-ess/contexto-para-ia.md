# Contexto completo del proyecto — Plataforma de Inspección Preoperacional de Seguridad Vial

> Este documento es el único contexto que vas a recibir sobre este proyecto. Está pensado para que puedas ayudar a redactar una propuesta comercial formal sin necesitar más información técnica de fondo — sí vas a necesitar que te den el formato/plantilla de la empresa y el valor de venta, que no están definidos acá todavía.

## 1. Qué es, en una frase
Aplicación web (instalable como PWA) que digitaliza la inspección preoperacional diaria de motocicletas de una empresa, reemplazando el formato en papel por un flujo guiado en el celular, con firma digital y generación automática del documento oficial en PDF — con trazabilidad completa de quién hizo cada cosa y cuándo.

## 2. Cliente y escala
Cliente: **ESS**. Escala inicial: **8 trabajadores**, cada uno realiza **1 inspección diaria** (~240 inspecciones/mes). Es una operación pequeña — la prioridad del cliente no es capacidad de procesamiento, sino confiabilidad del registro (el resultado final es un documento con valor legal/regulatorio) y un costo operativo bajo y predecible.

## 3. Estado del desarrollo
El flujo completo end-to-end **ya está construido y probado** — no es un prototipo ni un MVP a medio camino. El trabajo reciente ha sido refinamiento de UX y la construcción del panel de administración, no funcionalidad base. Esto es relevante para la propuesta: se está cotizando la puesta en producción y eventual mantenimiento/evolución de algo que ya funciona, no un desarrollo desde cero.

## 4. Los 5 roles del sistema
- **Trabajador**: realiza la inspección diaria del vehículo desde su celular.
- **Supervisor**: revisa cada inspección enviada y decide aprobar o rechazar; firma digitalmente después de tomar la decisión (no antes). Cualquier supervisor puede decidir sobre cualquier inspección — no hay un supervisor fijo asignado a cada trabajador.
- **Director**: tablero ejecutivo de indicadores y cumplimiento, de solo lectura.
- **SST** (Seguridad y Salud en el Trabajo): mismo tipo de acceso ejecutivo/de auditoría que Director.
- **Administrador**: gestiona el catálogo maestro de usuarios y vehículos; tiene acceso de lectura al resto del sistema pero deliberadamente no puede operar como trabajador ni decidir como supervisor (para no romper la trazabilidad de quién hizo cada acción real).

## 5. El flujo completo, paso a paso

**Como trabajador:**
1. Elige un vehículo activo para iniciar una inspección nueva (o retoma una que quedó a medias — el sistema lo lleva automáticamente al paso exacto donde se quedó).
2. Registra el kilometraje del vehículo.
3. Recorre, ítem por ítem, el checklist oficial (ver sección 6) — cada ítem tiene su propia pantalla con foto de referencia real de la moto, y se marca OK o FALLA.
4. Si un ítem queda en FALLA, se le pide describir qué pasó, elegir un tipo de novedad (las opciones cambian según si es un daño de carrocería, una falla funcional o un documento vencido/faltante) y, opcionalmente, adjuntar una foto tomada con la cámara.
5. Ve un resumen agrupado por categoría con barra de progreso (conformes / no conformes / pendientes).
6. Declara personalmente si considera que el vehículo puede operar hoy; si dice que no, debe justificarlo por escrito obligatoriamente.
7. Revisa el resumen final completo (con alertas en rojo si su pase de conducción o la revisión tecnicomecánica del vehículo están vencidos), firma de puño y letra en la pantalla táctil, y envía. El botón de enviar está bloqueado hasta que exista la firma.
8. Ve la pantalla de confirmación con el estado (pendiente, no apta, aprobada o rechazada) y puede descargar el PDF oficial una vez que ya tiene decisión.

**Como supervisor:**
1. Ve la lista de todas las inspecciones pendientes de decisión (las marcadas "no apta para operar" se resaltan en rojo como urgentes).
2. Abre el detalle: toda la información cargada por el trabajador, el checklist completo, las novedades con sus fotos, alertas de vencimiento.
3. Decide: Aprobar (observación opcional) o Rechazar (observación **obligatoria** — siempre debe quedar constancia escrita del motivo).
4. Después de decidir (no antes), firma digitalmente. Solo el supervisor que tomó esa decisión puede firmarla.
5. Una vez decidida, la inspección queda inmutable — no se puede volver a aprobar/rechazar ni cambiar el sentido de la decisión.

**Como Director/SST:** consultan un dashboard ejecutivo y un buscador histórico de inspecciones (ver sección 8), todo de solo lectura.

**Como Administrador:** gestiona usuarios y vehículos (ver sección 9).

## 6. El checklist real del formato oficial (17 ítems en 2 categorías)

Esto no es un catálogo genérico — es el contenido real auditado contra el Excel oficial de la empresa:

**Inspección Visual** (7 ítems, cada uno con foto de referencia real de las motos de ESS):
1. Luces Altas y Bajas
2. Direccionales y Estacionarias
3. Luz de Reversa
4. Espejos en buen estado
5. Llantas en buen estado
6. Estado de la latonería
7. Rayones (ítem especial: siempre exige indicar por escrito dónde está el daño y el tipo — rayón, rayón fuerte, abolladura, golpe fuerte)

**Documentación** (10 ítems, checklist simple sin foto, porque el formato original tampoco la trae):
1. SOAT
2. Cédula de ciudadanía
3. Carné de la compañía
4. Tarjeta de propiedad
5. Credencial SSP
6. Licencia de conducción vigente
7. Carné ARL
8. Carné EPS
9. Copia parafiscales mes en curso
10. Copia salvoconducto autenticada

Cada ítem es binario (OK o FALLA, sin "No aplica"). Además del checklist: se registra el kilometraje y la declaración personal del conductor sobre si el vehículo puede operar (distinta de la decisión oficial del supervisor).

**Nota de producto:** en una iteración anterior se probó una guía visual interactiva de la moto con zonas numeradas tipo mapa de calor; se descartó explícitamente por saturar la interfaz, y se volvió al formato "una pregunta, una pantalla, con foto de referencia arriba" — dato útil si la propuesta necesita mostrar que hubo un proceso de diseño iterativo, no solo "se construyó y ya".

## 7. Reglas de negocio ya resueltas (útiles para el "detalle técnico de la solución")

- **Nunca se borra nada físicamente** — ni inspecciones, ni usuarios, ni vehículos, ni firmas. Todo se desactiva/cancela, nunca desaparece. Esto es clave porque el producto final es un documento con valor legal: nunca se pierde evidencia.
- **Todas las horas oficiales las pone el servidor**, nunca el celular del trabajador — imposible fraguar cuándo se hizo una inspección.
- **La firma del conductor es un requisito real validado en el servidor** para poder enviar la inspección, no solo un botón deshabilitado en pantalla.
- **La firma es inmutable**: una vez creada, el sistema rechaza cualquier intento de reemplazarla.
- **Una inspección decidida (aprobada o rechazada) queda inmutable** — no se puede revertir ni volver a decidir.
- **Todo el control de acceso se revalida en el servidor en cada acción**, no solo ocultando botones en la pantalla según el rol.
- **Auditoría completa (`AuditLog`)**: cada acción de negocio relevante (iniciar/cancelar/enviar inspección, aprobar, rechazar, firmar como conductor o supervisor, crear/editar usuario o vehículo, restablecer contraseña) queda registrada con quién, qué, sobre qué y cuándo. Las contraseñas nunca se registran, ni siquiera hasheadas. Esto le da al cliente una traza de auditoría que el papel no puede ofrecer — un argumento de venta concreto.
- **Alertas de vencimiento automáticas**: se resalta en rojo si el pase de conducción del conductor o la revisión tecnicomecánica del vehículo están vencidos, tanto para el trabajador como para el supervisor, antes de que la unidad salga a operar.

## 8. Dashboard ejecutivo y consulta (Director / SST)

- **Informes de Gerencia**: KPIs generales, tendencia diaria, aprobadas/rechazadas/pendientes, ranking de trabajadores y de vehículos, novedades por tipo, fallas más frecuentes por ítem, mapa de calor de cumplimiento, alertas ejecutivas automáticas (ej. vehículos con novedades repetidas), Top 5, tabla de detalle paginada. Todo filtrable (fecha, trabajador, placa, estado, resultado, supervisor) y **exportable a Excel**.
- **Consulta de inspecciones**: buscador histórico de solo lectura, con filtros por conductor, placa, estado y rango de fechas.

## 9. Panel de administración

El Administrador gestiona dos catálogos maestros:
- **Usuarios**: crear (con rol, cédula, teléfono, cargo, vencimiento del pase), editar cualquier dato incluido el rol y el estado activo/inactivo, restablecer contraseña (acción separada de la edición, la define el propio administrador y la comunica por fuera del sistema — no hay envío de correo automático), y buscar/filtrar por nombre, email, cédula, rol y estado.
- **Vehículos**: crear y editar (placa, tipo, vencimiento de tecnicomecánica, activo/inactivo).

## 10. Capacidad offline / PWA — limitación importante a tener clara

La app es instalable como PWA (ícono en el celular, pantalla completa), pero **hoy solo cachea el "app shell"** (los archivos estáticos: JS, CSS, íconos) y recursos ya visitados. **No existe** una cola de sincronización diferida ni almacenamiento local que permita completar una inspección nueva sin conexión y que se suba sola después. Cada paso del flujo (responder un ítem, subir una foto, firmar, enviar) necesita conexión a internet en el momento en que se hace.

**En criollo:** la app abre más rápido y muestra pantallas ya visitadas aunque la señal sea intermitente, pero **completar y enviar una inspección nueva de punta a punta requiere internet en ese momento**. Si el cliente pregunta si funciona en una zona sin señal con sincronización automática después, la respuesta honesta hoy es que no — sería una funcionalidad adicional a construir, no algo ya implementado. Importante no prometer esto en la propuesta si no se va a cotizar aparte.

## 11. Qué es el formato FO-SVS-23

Es el **formato oficial interno de la empresa** (no se encontró en el código ninguna referencia a una norma o resolución gubernamental específica, así que no debe presentarse como un estándar regulatorio nacional obligatorio sin confirmarlo directamente con el cliente). Título literal: "Formato Inspección Vehículos", código FO-SVS-23, versión 1, vigente desde 30/08/2016. El PDF generado reproduce el Excel original celda por celda, incluyendo sus textos exactos (ej. "ANTES DE PRENDER EL MOTOR REVISE NIVELES", "LA UNIDAD PUEDE SALIR A OPERAR") — se digitalizó el documento tal cual, sin corregirlo. El formato original cubre "Carros" y "Motos" en columnas separadas; como ESS solo opera motos, el PDF conserva el espacio del bloque de carros en blanco y completa solo el de motos, para no alterar el diseño oficial de la empresa.

## 12. Stack técnico
- **Framework**: Next.js 16 (React 19), con renderizado en servidor y Server Actions.
- **Base de datos**: PostgreSQL vía Prisma ORM (driver estándar `pg`, sin acoples a un proveedor específico).
- **Generación de PDF**: server-side con `@react-pdf/renderer`.
- **Almacenamiento de archivos** (fotos de novedades): protocolo estándar S3 — compatible con cualquier proveedor (AWS S3, Cloudflare R2, Railway Buckets) sin cambios de código. Nunca se guarda una URL pública permanente, solo una referencia interna; las fotos se sirven con enlaces temporales firmados.
- **Autenticación**: NextAuth, usuario/contraseña con bcrypt (sin login social ni email transaccional por ahora).
- **PWA**: instalable, con Serwist (ver limitación offline en sección 10).

## 13. Decisión de infraestructura ya tomada (no hace falta re-evaluarla)
Se evaluaron VPS autoadministrado (ej. Hostinger), arquitectura multi-proveedor (Vercel+Neon+R2) y una plataforma administrada única (Railway). **Se eligió Railway**: hosting de la app + PostgreSQL administrado + almacenamiento S3-compatible, todo bajo una sola cuenta/factura, con SSL automático y backups incluidos.

## 14. Costos ya cotizados
- **Railway plan Pro: USD $20/mes** — cubre hosting + base de datos + almacenamiento + SSL + backups. Es un modelo de crédito de uso (piso de $20; si el consumo real se mantiene por debajo, no se cobra de más). Con el volumen de ESS (8 usuarios, ~240 inspecciones/mes) se estima que el consumo cae dentro de ese crédito, a confirmar con la primera factura real.
- **Dominio**: ya lo tiene el cliente, fuera de esta cotización.
- No hay email transaccional ni SMS integrados hoy — si se agregan a futuro, es un costo adicional a cotizar aparte.

## 15. Qué falta definir (para que la propuesta lo cubra)
- Valor de venta del proyecto (desarrollo + puesta en producción) — pendiente de definir internamente.
- Formato/plantilla de la empresa para la propuesta — se aplica aparte, este contexto es solo insumo de contenido.
- Si el cliente pide capacidad offline real (sección 10), eso es alcance adicional a cotizar, no algo ya incluido.
