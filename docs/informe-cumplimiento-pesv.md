# Informe de cumplimiento normativo: Preoperacional Seguridad Vial (FO-SVS-23)

**Fecha:** 28 de septiembre de 2026
**Organización:** ESS LTDA, empresa de vigilancia y seguridad privada
**Objeto:** qué parte del Plan Estratégico de Seguridad Vial (PESV) cubre la aplicación de inspección preoperacional para motos y carros, qué falta y a quién obliga la norma.

> **Aviso:** este informe se basa en el análisis técnico del código fuente y en una investigación de fuentes públicas. No es un concepto jurídico. Los puntos marcados como *no verificado* deben confirmarse con la fuente oficial o con un asesor PESV o abogado antes de presentarlos ante una autoridad.

---

## 1. Resumen ejecutivo

1. **La norma no rige para todas las empresas.** El PESV es obligatorio para cualquier entidad pública o privada que tenga una flota de **más de 10 vehículos**, contando los vehículos de los trabajadores puestos al servicio de la empresa, **o** que **contrate o administre conductores**. Ver la sección 3.
2. Por su actividad, ESS LTDA se clasificaría en la **misionalidad 2** (actividad distinta al transporte). Su nivel (Básico, Estándar o Avanzado) depende del número de vehículos y conductores.
3. La aplicación responde directamente al **Paso 16 de la Resolución 40595 de 2022** (inspección de vehículos y equipos). Ese paso exige un mecanismo de registro de la **inspección preoperacional diaria**, con lista de chequeo, responsables de ejecutarla y de controlarla, y conservación del **último año**. La aplicación cumple estos elementos y agrega controles que la norma no exige: fotos, firmas, autodeclaración del conductor y aprobación del supervisor.
4. También aporta evidencia parcial a los **Pasos 8, 17, 19, 20, 22 y 23**. Ver la matriz de la sección 5.
5. Las brechas principales son estas:
   - No hay plan de mantenimiento (Paso 17).
   - No hay seguimiento ni cierre de novedades.
   - No hay control de quién **dejó de hacer** la inspección.
   - No hay bloqueo del vehículo cuando la decisión es "no apto".
   - No hay alerta de vencimiento del SOAT en el flujo.
   - No hay sello de integridad (hash) del PDF ni consentimiento para tratar datos sensibles de salud.

---

## 2. Marco normativo aplicable

| Norma | Qué establece | Relación con el proyecto |
|---|---|---|
| **Ley 1503 de 2011, art. 12** (modificado por el art. 110 del Decreto Ley 2106 de 2019) | Obligación de diseñar e implementar el PESV | Define quién está obligado |
| **Ley 2050 de 2020** | Verificación del PESV (Supertransporte, organismos de tránsito o Mintrabajo, según competencia) y régimen sancionatorio | Supervisión y sanciones |
| **Decreto 1079 de 2015**, art. 2.3.2.3.2 | PESV según misionalidad y tamaño, articulado con el SG-SST | Base reglamentaria |
| **Resolución 20223040040595 de 2022** (Mintransporte, 12 de julio de 2022) | **Metodología del PESV: 24 pasos en 4 fases (PHVA)**. Deroga la Res. 1565 de 2014 | Norma central. El Paso 16 es el preoperacional |
| **Resolución 20223040045295 de 2022** | Resolución Única Compilatoria del Mintransporte. Compila la 40595 (arts. 7.2.1 a 7.2.4) | Solo compila, no cambia el contenido |
| **Decreto 1072 de 2015** (art. 2.2.4.6.24) y **Res. 0312 de 2019** | SG-SST: medidas de prevención y control | El PESV se articula con el SG-SST |
| **Circular 034 de 2026** (Mintrabajo, 30 de marzo de 2026) | Reporte de autogestión de misionalidad 2 mediante formulario en línea | Reporte anual de indicadores (*fuente secundaria, texto oficial no revisado*) |
| **Ley 527 de 1999** | Validez de mensajes de datos y firma electrónica | Validez probatoria del registro digital y de las firmas |
| **Ley 1581 de 2012** | Protección de datos personales | La autodeclaración de salud y alcohol es un **dato sensible** |
| **Decreto Ley 356 de 1994** y **Res. 2852 de 2006** (Supervigilancia) | Solo se pueden usar vehículos autorizados. Hay que mantener una relación de vehículos con sus documentos vigentes | Régimen propio de la vigilancia privada (*vigencia del articulado no verificada*) |
| Ley 769 de 2002 y Ley 1696 de 2013 | SOAT, revisión técnico-mecánica, licencia; sanciones por alcohol | Contexto de los ítems del checklist (*no verificado en esta investigación*) |

**Actualizaciones recientes:** no se encontró una modificación de fondo a la Resolución 40595 hasta la fecha. Los cambios de 2024 a 2026 tratan de **cómo se reporta** (VIGÍA 2 para transporte y formulario de Mintrabajo para misionalidad 2), no de los 24 pasos. La Res. 20243040045005 de 2024 trata de señalización vial y **no** de PESV.

---

## 3. ¿La norma rige para todas las empresas?

**No.** Según el art. 12 de la Ley 1503 (modificado) y la Resolución 40595, está obligada toda entidad, organización o empresa, **pública o privada**, que:

- tenga una flota de vehículos automotores o no automotores **superior a diez (10) unidades**, **o**
- **contrate o administre personal de conductores**.

Hay que tener en cuenta tres aclaraciones:

- **Cuentan los vehículos de los trabajadores** que se usan para la misión de la empresa. Una moto propia del guarda, usada para rondas o desplazamientos del servicio, cuenta en la flota.
- Se considera **conductor** a quien usa un vehículo puesto al servicio de la organización, sin importar cómo esté vinculado (contrato directo, temporal, contratista).
- Si la organización cumple criterios de dos niveles, aplica **el más alto**.

### Niveles (Tabla 1 de la metodología)

| Misionalidad | Básico | Estándar | Avanzado |
|---|---|---|---|
| **1:** Transporte terrestre automotor como actividad principal | 11 a 19 vehículos, o 2 a 19 conductores | 20 a 50 | más de 50 |
| **2:** Actividad distinta al transporte (**ESS LTDA**) | 11 a 49 vehículos, o 2 a 49 conductores | 50 a 100 | más de 100 |

> **Ojo con el criterio de conductores:** la tabla del nivel Básico empieza en **2 conductores**. Eso significa que una empresa con pocos vehículos pero con personal que conduce para ella puede quedar obligada. Esta es una lectura literal del texto: conviene confirmarla con el asesor PESV para el caso concreto de ESS LTDA.

**Conclusión para ESS LTDA:** una empresa de vigilancia con guardas motorizados que usan moto o carro para el servicio **muy probablemente está obligada**, en misionalidad 2. El nivel exacto sale de contar vehículos (propios y de los trabajadores) y conductores. Si la empresa prestara transporte de valores como actividad de transporte, habría que revisar la clasificación.

**Plazos:** las empresas nuevas tienen 1 año desde su constitución. Si un paso no aplica, se documenta la justificación y la auditoría interna la valida.

---

## 4. Qué hace la aplicación hoy

### 4.1 Arquitectura

- **Web y PWA** en Next.js 16 y React 19, con base de datos PostgreSQL mediante Prisma 7 y almacenamiento de fotos y firmas en S3 compatible (MinIO, AWS o R2), con URLs firmadas de 15 minutos.
- **Autenticación** con NextAuth v5 (correo y contraseña con bcrypt) y control de acceso por rol en dos capas: `proxy.ts` y `requireRole` en cada acción del servidor.
- **Roles:** TRABAJADOR, SUPERVISOR, DIRECTOR, SST y ADMINISTRADOR.
- **Calidad:** 30 archivos de pruebas automatizadas (Vitest contra PostgreSQL real) y CI en GitHub Actions (tipado, lint y pruebas en cada push).

### 4.2 Flujo del trabajador (inspección diaria)

1. **Inicio:** solo sobre **su** vehículo asignado (1 usuario = 1 vehículo), que debe estar activo y ser del mismo tipo (moto o carro). No se duplican inspecciones en curso: se reutiliza la abierta de las últimas 24 horas.
2. **Kilometraje.**
3. **Lista de chequeo por tipo de vehículo**, una pregunta por pantalla, con imagen de referencia:

| Sección | Moto | Carro |
|---|---|---|
| Inspección visual | Espejos, frenos, luces con direccionales, llantas, **casco** | Espejos, frenos, luces altas/bajas/reversa/internas, llantas con repuesto, **cinturones**, **limpiabrisas** |
| Fluidos (Bueno / Bajo) | Aceite, líquido de frenos, refrigerante | Aceite, líquido de frenos, refrigerante |
| Equipo de prevención | Canguro de emergencia vial | **Botiquín**, **extintor** |
| Documentación | Licencia de tránsito, **SOAT**, **revisión técnico-mecánica**, **licencia de conducción**, cédula | Igual |

   En total son 14 ítems para moto y 16 para carro. Una FALLA o un MALO genera una **novedad** obligatoria, con tipo (rayón, abolladura, golpe, falla, daño, faltante, vencido), descripción y foto opcional.
4. **Declaración del estado del conductor** (3 preguntas): consumo de medicamentos o sustancias, condiciones físicas y mentales adecuadas, y consumo de alcohol. Una respuesta de riesgo **no bloquea**: se marca como alerta para el supervisor y en el PDF.
5. **Fotos diarias obligatorias:** lateral y placa del vehículo.
6. **Resultado:** el conductor declara si el vehículo puede operar. Si no puede, la justificación es obligatoria.
7. **Firma del conductor** trazada en pantalla. Queda inmutable.
8. **Envío.** El servidor valida que todo esté completo y pasa la inspección a *Pendiente de aprobación* o a *No apta para operar*.

### 4.3 Flujo del supervisor

- Revisa el detalle: novedades con fotos, alerta del estado del conductor y técnico-mecánica vencida.
- **Aprueba** (observación opcional) o **rechaza** (observación obligatoria). La decisión es inmutable y queda con la fecha y hora del servidor.
- Firma después de decidir. Solo puede firmar el supervisor que tomó la decisión.

### 4.4 Registro oficial y gestión

- **PDF FO-SVS-23** con código, versión y fecha de vigencia configurable. Incluye todo el registro: checklist, fotos, declaración, novedades con evidencia, decisión y firmas con nombre, cédula y hora. Solo el rol SST lo puede descargar.
- **Hoja de vida del vehículo:** foto, marca, modelo, color y vencimiento del SOAT y de la técnico-mecánica, con semáforo vigente / por vencer (30 días) / vencido.
- **Tablero de indicadores:** total de inspecciones, aprobadas, rechazadas, con novedades, pendientes y tasa de aprobación, comparados con el periodo anterior. Incluye tendencia diaria, mapa de calor de cumplimiento, cumplimiento por trabajador y por vehículo, fallas por ítem, top 5 de vehículos con novedades y alertas. Se puede filtrar por fechas, trabajador, placa, estado y supervisor.
- **Exportación a Excel** para DIRECTOR y SST.
- **Bitácora de auditoría:** registra ingreso, inicio, envío, cancelación, aprobación, rechazo, firmas, fotos, creación y edición de usuarios y vehículos, restablecimiento de contraseñas y cambios de configuración.
- **No se borra nada:** las inspecciones solo se cancelan.

---

## 5. Matriz de cumplimiento frente a la Resolución 40595 de 2022

Convención: ✅ cubierto, 🟡 parcial o apoyo como evidencia, ❌ no cubierto por la aplicación, ➖ fuera del alcance de una aplicación (es gestión organizacional).

| Paso | Requisito | Estado | Cómo lo atiende la aplicación / qué falta |
|---|---|---|---|
| 1 a 7 | Líder, comité, política, compromiso directivo, diagnóstico, riesgos, objetivos | ➖ | Son decisiones y documentos de la organización. El tablero puede aportar datos al diagnóstico (Paso 5) y a la caracterización de riesgos (Paso 6) |
| 8 | Programas de riesgos críticos: **cero alcohol y sustancias psicoactivas**, fatiga | 🟡 | La autodeclaración diaria de alcohol, medicamentos y aptitud queda registrada y alerta al supervisor. **No sustituye** las pruebas aleatorias de alcohol ni los controles anuales que exige el paso. No hay control de fatiga (horas de conducción) |
| 10 | Competencia y plan de formación | ❌ | No hay registro de capacitaciones de los conductores |
| 12 | Plan de emergencias viales | 🟡 | Solo se verifica que el equipo esté presente: botiquín, extintor, canguro de emergencia |
| 13 y 21 | Investigación y estadística de siniestros | ❌ | No hay módulo de accidentes o incidentes |
| 15 | Planificación de desplazamientos | ❌ | No hay rutas, horarios ni geolocalización |
| **16** | **Inspección preoperacional diaria con lista de chequeo, responsables de ejecutar y controlar, conservación de 1 año** | ✅ | **Es el núcleo de la aplicación.** Checklist por tipo de vehículo, alineado con los elementos que cita la norma: documentos, luces, llantas, fluidos, cinturones, limpiabrisas, espejos, equipo de prevención y casco. El responsable de ejecutar es el TRABAJADOR y el de controlar es el SUPERVISOR. El registro es fechado e inmutable, con PDF. Los registros se conservan indefinidamente, más del año exigido. La norma sugiere alertas de vencimiento: están para la técnico-mecánica, pero **no para el SOAT dentro del flujo** |
| **17** | Mantenimiento preventivo, **hoja de vida del vehículo** con historial, mantenimiento de vehículos propios de los trabajadores, **retroalimentado por los preoperacionales** | 🟡 | La hoja de vida existe (foto, datos, vencimientos). **Faltan** el plan de mantenimiento, el historial de reparaciones y el cierre de novedades: una falla detectada en el preoperacional no genera una orden de mantenimiento ni se sigue hasta resolverla |
| 18 | Gestión de contratistas | ➖ | Organizacional |
| 19 | Archivo y retención documental (5 años en general, **1 año para los preoperacionales**), con protección de datos (Ley 1581) | 🟡 | Registros permanentes, sin borrado. **Falta:** política de retención y respaldos documentada, y autorización expresa para el dato sensible de salud y alcohol |
| **20** | Indicadores y reporte anual de autogestión | 🟡 | El tablero y el Excel dan indicadores de inspección. **No** calcula "inspecciones esperadas contra realizadas" (no hay programación), ni los indicadores de siniestralidad de la Tabla 10 |
| 22 | Auditoría interna anual | 🟡 | La bitácora de auditoría y los PDF sirven como evidencia. **No hay pantalla** para consultar la bitácora |
| 23 | Acciones preventivas y correctivas | 🟡 | Las novedades y los rechazos quedan registrados. No hay flujo de acción correctiva con responsable y cierre |
| 24 | Comunicación y participación | ❌ | No hay notificaciones (correo, SMS, push) |

### Valor agregado sobre el mínimo legal

La Resolución 40595 **no exige** los siguientes controles. La aplicación los incluye y fortalecen la calidad de la evidencia:

- Fotos diarias obligatorias del vehículo (lateral y placa).
- Firmas del conductor y del supervisor.
- Autodeclaración del estado del conductor.
- Aprobación o rechazo del supervisor con observación.
- Validación estricta del lado del servidor: no se puede enviar una inspección incompleta.

---

## 6. Validez del registro digital (Ley 527 de 1999)

| Artículo | Exigencia | Situación en la aplicación |
|---|---|---|
| Art. 7 (firma) | Método que identifique a quien firma e indique que aprueba el contenido, y que sea confiable | ✅ Firma trazada, ligada al usuario autenticado, con fecha y hora del servidor, inmutable |
| Arts. 8 y 9 (original e integridad) | Garantía confiable de que la información no se alteró | 🟡 Inmutabilidad a nivel de aplicación y base de datos. **No hay hash** del registro ni del PDF |
| Art. 11 (valor probatorio) | Confiabilidad en la generación, el archivo y la identificación del iniciador | 🟡 Bitácora de auditoría y control de acceso por rol. Mejoraría con hash y con una política de respaldos |
| Art. 12 (conservación) | Accesible, reproducible con exactitud, con origen, fecha y hora | 🟡 El PDF se **regenera** cada vez a partir de los datos. No se archiva una copia sellada del momento de la firma |

---

## 7. Brechas y recomendaciones priorizadas

| Prioridad | Brecha | Recomendación | Norma que lo sustenta |
|---|---|---|---|
| **Alta** | Una inspección "no apta" revisada termina como APROBADA o RECHAZADA, y **el vehículo no queda bloqueado** para operar | Que un estado "no apto" o rechazado bloquee la operación del vehículo hasta que se cierre la novedad | Paso 16 (control), Paso 17 |
| **Alta** | Las novedades no tienen seguimiento ni cierre | Flujo de novedad: abierta → en reparación → cerrada, con responsable y evidencia | Pasos 17 y 23 |
| **Alta** | No hay autorización para tratar datos sensibles (salud y alcohol) | Consentimiento informado en el primer ingreso y política de tratamiento de datos | Ley 1581 de 2012, Paso 19 |
| **Alta** | Falta la fecha de vigencia real del formato | Configurarla en `/admin/configuracion` antes de la puesta en producción | Control documental |
| Media | No se detecta a quién **no** hizo la inspección del día | Programación o turnos y un indicador de inspecciones esperadas contra realizadas, con alerta | Pasos 16 y 20 |
| Media | El SOAT no alerta en el flujo ni en el PDF, y no se registra el vencimiento ni la categoría de la licencia de conducción | Alertas de SOAT y datos de la licencia (categoría y vencimiento) en la hoja de vida del conductor | Paso 16 (buena práctica), Ley 769 |
| Media | No hay sello de integridad | Guardar el hash SHA-256 y una copia del PDF en S3 al momento de la firma del supervisor | Ley 527, arts. 8, 9 y 12 |
| Media | No hay plan de mantenimiento | Módulo de mantenimiento preventivo por kilometraje o fecha, alimentado por las novedades | Paso 17 |
| Media | No hay pantalla para consultar la auditoría | Vista de solo lectura de la bitácora para SST y auditor | Paso 22 |
| Baja | Sin notificaciones ni modo sin conexión | Avisos al supervisor. Cola sin conexión para zonas sin señal | Paso 24 |
| Baja | Capacitación y siniestros | Módulos de formación y reporte de incidentes | Pasos 10, 13 y 21 |

---

## 8. Supervisión y sanciones

- **Quién verifica el PESV:** la Superintendencia de Transporte, los organismos de tránsito o el Ministerio del Trabajo, según su competencia (Ley 2050 de 2020). Para empresas de **misionalidad 2** como ESS LTDA, el reporte se hace ante **Mintrabajo** (Circular 034 de 2026). El reporte extemporáneo se sanciona según el **art. 13 de la Ley 1562 de 2012** (*cuantías no verificadas*).
- **Reporte anual de autogestión** (Paso 20): se presentan los indicadores con corte al 31 de diciembre, a más tardar el **31 de enero** del año siguiente, junto con el último informe de auditoría interna. Para el año 2025, la Circular 034 de 2026 fijó un plazo excepcional: el 31 de mayo de 2026.
- **Supervigilancia:** en las fuentes revisadas **no** figura como verificador del PESV. Sí exige, por su propio régimen, usar solo vehículos autorizados y mantener una relación de vehículos con los documentos vigentes. La hoja de vida del vehículo de la aplicación ayuda a cumplir esa exigencia.

---

## 9. Conclusión

La aplicación **resuelve de forma completa y verificable el Paso 16 de la Resolución 40595 de 2022**, que es la obligación más operativa y diaria del PESV. Registra una inspección preoperacional por vehículo con lista de chequeo diferenciada para moto y carro, con responsables de ejecutar y controlar y con evidencia fechada, firmada y fotografiada. Además, supera el mínimo legal en calidad de evidencia.

Sin embargo, **la aplicación no es el PESV completo.** El PESV tiene 24 pasos, y la mayoría son de gestión organizacional. Para que la aplicación aporte al máximo en una auditoría, las prioridades son:

1. Bloquear la operación y cerrar las novedades (Pasos 16, 17 y 23).
2. Formalizar el consentimiento de datos sensibles (Ley 1581).
3. Sellar la integridad del registro (Ley 527).
4. Medir quién dejó de inspeccionar (Pasos 16 y 20).

---

## 10. Fuentes

- Resolución 20223040040595 de 2022, texto oficial: https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/pdf/resolucion_mintransporte_40595_2022.pdf
- ANSV, reporte de autogestión del PESV: https://ansv.gov.co/es/atencion-ciudadania/preguntas/8-como-y-cuando-se-debe-hacer-el-reporte-de-autogestion-del-pesv
- Circular 034 de 2026: https://detransito.net/normatividad/circular-034-de-2026/, https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=192890&dt=S (fuentes secundarias)
- Supertransporte, VIGÍA 2 (Res. 14305 de 2024): https://www.supertransporte.gov.co/index.php/comun-enero-2025/la-supertransporte-adopto-mediante-la-resolucion-14305-24-el-sistema-inteligente-nacional-de-supervision-al-transporte-vigia-2/
- Supertransporte, Res. 5178 de 2023: https://www.supertransporte.gov.co/documentos/2023/Agosto/Despacho_01/RES_PIPESV_5178-de-2023.pdf
- Decreto Ley 356 de 1994: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=1341
- Supervigilancia, Res. 2852 de 2006: https://www.supervigilancia.gov.co/en/resolucion-2852-de-08-08-06-se-unifica-el-regimen-de-vigilancia-y-seguridad-privada
- Res. 20243040045005 de 2024 (señalización, no PESV): https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=166597&dt=S
- Ley 527 de 1999: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276

### Pendiente de verificar con una fuente primaria o un asesor

- Textos de la Ley 769 de 2002, la Ley 1696 de 2013, el Decreto 2364 de 2012 y el art. 13 de la Ley 1562 de 2012 (cuantías de las sanciones).
- Vigencia actual del articulado sobre vehículos de la Res. 2852 de 2006 (Supervigilancia).
- Texto oficial de la Circular 034 de 2026.
- Clasificación y nivel exactos de ESS LTDA según el conteo real de vehículos y conductores.
