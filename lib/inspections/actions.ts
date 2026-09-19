"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, ForbiddenError } from "@/lib/auth/requireRole";
import { Role, InspectionStatus, RespuestaChecklist, TipoFirma, TipoVehiculo } from "@/generated/prisma/client";
import type { TipoNovedad } from "@/generated/prisma/client";
import { uploadObject } from "@/lib/storage/s3";
import { PREGUNTAS_ESTADO_CONDUCTOR, type CampoEstadoConductor } from "@/lib/inspections/estado-conductor";
import {
  getChecklistCatalog,
  FOTOS_DIARIAS_REQUERIDAS,
} from "@/lib/inspections/queries";
import { TIPO_NOVEDAD_LABELS } from "@/lib/inspections/novedad-tipo";
import { esNovedad, valoresPermitidos } from "@/lib/inspections/respuesta";

// Server actions del flujo de inspección del TRABAJADOR (Fase 2). Todas
// validan rol vía `requireRole` (nunca confían en el frontend) y, cuando
// aplica, que la inspección pertenezca al usuario autenticado — el
// middleware/proxy es solo la primera barrera a nivel de ruta.
//
// Reglas heredadas de Fase 1 que se respetan acá: nunca hay ventana horaria
// para iniciar una inspección, los timestamps oficiales (`startedAt` vía
// default de Prisma, `completedAt` con `new Date()`) siempre se generan en
// el servidor, y una inspección enviada nunca se borra ni se edita
// retroactivamente (por eso las mutaciones de este archivo verifican
// `status === EN_PROCESO` antes de escribir).

/**
 * Valida que la inspección exista, pertenezca al trabajador autenticado y
 * siga EN_PROCESO (una inspección enviada nunca se edita retroactivamente).
 */
async function getOwnInspeccionEnProceso(inspectionId: string, workerId: string) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });

  if (!inspection || inspection.workerId !== workerId) {
    throw new ForbiddenError("Esta inspección no pertenece al usuario autenticado.");
  }
  if (inspection.status !== InspectionStatus.EN_PROCESO) {
    throw new Error("La inspección ya no está en proceso: no se puede modificar.");
  }

  return inspection;
}

/**
 * Crea una nueva inspección para el vehículo indicado. `startedAt` lo pone
 * el default de Prisma (`now()` del servidor). Sin restricción de ventana
 * horaria: puede iniciarse en cualquier momento.
 *
 * `conductorId` se setea igual a `workerId`: en el flujo actual, quien hace
 * la inspección es siempre el conductor responsable de la unidad (99% de los
 * casos, decisión de negocio confirmada por el dueño de producto). El
 * formato oficial FO-SVS-23 trata "Conductor" y "Quién hace la inspección"
 * como campos conceptualmente distintos, por eso el schema los modela por
 * separado (`Inspection.conductorId` vs `Inspection.workerId`) aunque hoy
 * siempre coincidan — no se construyó una pantalla para elegir un conductor
 * distinto porque no fue pedido (sería alcance extra de esta fase).
 */
export async function iniciarInspeccion(vehicleId: string) {
  const session = await requireRole([Role.TRABAJADOR]);

  // Cada trabajador tiene UN vehículo (1:1, `User.vehicleId`, decisión del
  // usuario 2026-09-18). Defensa en profundidad: la pantalla de inicio
  // (app/(worker)/inspecciones/page.tsx) ya muestra solo ese vehículo, pero
  // acá se re-valida en el servidor, nunca se confía en que el frontend haya
  // mandado el correcto. Un trabajador legacy sin vehículo no puede iniciar
  // ninguna inspección hasta que SST/Administrador complete su hoja de vida.
  const trabajador = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { vehicleId: true, tipoVehiculo: true },
  });
  if (!trabajador?.vehicleId) {
    throw new Error(
      "Pendiente de asignación de vehículo: solicita a SST o al Administrador que complete tu hoja de vida.",
    );
  }
  if (trabajador.vehicleId !== vehicleId) {
    throw new Error("Este vehículo no es el vehículo asignado al trabajador.");
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || !vehicle.activo) {
    throw new Error("Vehículo no encontrado o inactivo.");
  }

  // Fase soporte-moto-carro (A1): el tipo del trabajador debe coincidir con
  // el de su vehículo (datos inconsistentes no abren ningún catálogo).
  // Vehículos legacy sin tipo resuelven a MOTO (mismo backfill del Slice 1);
  // un trabajador sin tipo asignado nunca puede iniciar ninguna inspección.
  const tipoVehiculo = vehicle.tipoVehiculo ?? TipoVehiculo.MOTO;
  if (trabajador.tipoVehiculo === null || trabajador.tipoVehiculo !== tipoVehiculo) {
    throw new Error("Este vehículo no corresponde al tipo de vehículo asignado al trabajador.");
  }

  const inspection = await prisma.inspection.create({
    data: {
      workerId: session.user.id,
      conductorId: session.user.id,
      vehicleId,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "INICIAR_INSPECCION",
    entityType: "Inspection",
    entityId: inspection.id,
    metadata: { vehicleId },
  });

  return inspection;
}

/**
 * Cancela (descarta) una inspección propia que sigue EN_PROCESO. No es un
 * borrado — el registro queda en la base (regla de inmutabilidad del
 * proyecto), solo pasa a un estado terminal (`CANCELADA`) y deja de
 * aparecer en "En proceso" (app/(worker)/inspecciones/page.tsx).
 *
 * Idempotente si ya está CANCELADA: un doble tap en la ✕ (sin feedback
 * visual mientras se procesa la primera cancelación) puede disparar el
 * server action dos veces sobre la misma inspección — la segunda vez no
 * debe explotar, el estado final que el usuario quería ya es el real.
 * Cualquier OTRO estado (enviada, aprobada, etc.) sigue rechazándose: ahí sí
 * hay algo real que proteger.
 */
export async function cancelarInspeccion(inspectionId: string) {
  const session = await requireRole([Role.TRABAJADOR]);

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.workerId !== session.user.id) {
    throw new ForbiddenError("Esta inspección no pertenece al usuario autenticado.");
  }
  if (inspection.status === InspectionStatus.CANCELADA) {
    return inspection;
  }
  if (inspection.status !== InspectionStatus.EN_PROCESO) {
    throw new Error("Solo se puede cancelar una inspección que sigue en proceso.");
  }

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: InspectionStatus.CANCELADA },
  });

  await logAudit({
    userId: session.user.id,
    action: "CANCELAR_INSPECCION",
    entityType: "Inspection",
    entityId: inspectionId,
  });

  return updated;
}

/**
 * Registra el kilometraje de la inspección. No es un check
 * conforme/no-conforme, por eso vive como campo de `Inspection` y no como
 * ChecklistItem — ver comentario en prisma/schema.prisma.
 */
export async function registrarKilometraje(
  inspectionId: string,
  data: { kilometraje: number },
) {
  const session = await requireRole([Role.TRABAJADOR]);
  await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  if (!Number.isFinite(data.kilometraje) || data.kilometraje < 0) {
    throw new Error("Kilometraje inválido.");
  }

  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      kilometraje: Math.trunc(data.kilometraje),
    },
  });
}

/**
 * Crea o actualiza la respuesta a un ítem del checklist. Si `valor` es
 * FALLA, requiere `tipo` (Fase C) y crea/actualiza la Novedad asociada,
 * guardando también `ubicacion` cuando corresponde. Si un ítem que tenía
 * una Novedad deja de estar en FALLA, la Novedad (y sus fotos en base de
 * datos) se retira — no se borran los objetos en S3 en este caso, ver
 * limitación documentada en el reporte de Fase 2.
 *
 * Los ítems con `pideUbicacion` (hoy: "Rayones") reutilizan `observacion`
 * para la respuesta "¿Dónde?" en `InspectionItemResponse.observacion`, pero
 * solo se exige cuando `valor` es FALLA — si el ítem queda OK no hay nada
 * que ubicar. Cuando ese mismo ítem queda en FALLA, ese mismo texto viaja
 * como `Novedad.ubicacion`
 * (Fase C: no se pide un segundo campo "¿Dónde?" en la pantalla dedicada de
 * novedad para este ítem). Como esa pantalla especial no tiene su propio
 * textarea de descripción, `Novedad.descripcion` se completa con la
 * etiqueta legible de `tipo` (ej. "Rayón fuerte") — sigue siendo un texto
 * que explica qué pasó, sin pedirle al trabajador escribirlo dos veces.
 * Para el resto de los ítems, `observacion` (textarea de la pantalla de
 * novedad genérica) es la `descripcion` y `ubicacion` es el campo "¿Dónde?"
 * opcional de esa misma pantalla.
 */
export async function responderItem(
  inspectionId: string,
  checklistItemId: string,
  valor: RespuestaChecklist,
  observacion?: string,
  tipo?: TipoNovedad,
  ubicacion?: string,
) {
  const session = await requireRole([Role.TRABAJADOR]);
  const inspection = await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  const item = await prisma.checklistItem.findUnique({ where: { id: checklistItemId } });
  if (!item) {
    throw new Error("Ítem de checklist no encontrado.");
  }

  // Corrección Slice 2 (hallazgo CRITICAL #1, corroborado por 3 lentes de
  // revisión): antes de este chequeo, `responderItem` solo validaba `valor`
  // contra el `tipoRespuesta` del propio ítem, nunca que el ítem
  // perteneciera al catálogo del tipo de vehículo de ESTA inspección. Eso
  // permitía "colar" una respuesta a un ítem exclusivo de otro tipo (ej.
  // "Cinturones de seguridad", solo CARRO) en una inspección MOTO, inflando
  // el conteo de respuestas que `enviarInspeccion` usaba para decidir si el
  // checklist estaba completo. Se resuelve el tipo de vehículo de la
  // inspección (nunca el que mande el cliente) y se compara contra
  // `ChecklistItem.tipoVehiculo` (`null` = aplica a ambos tipos, A1 del
  // design).
  const vehiculoInspeccion = await prisma.vehicle.findUnique({
    where: { id: inspection.vehicleId },
    select: { tipoVehiculo: true },
  });
  const tipoVehiculoInspeccion = vehiculoInspeccion?.tipoVehiculo ?? TipoVehiculo.MOTO;
  if (item.tipoVehiculo !== null && item.tipoVehiculo !== tipoVehiculoInspeccion) {
    throw new Error(
      `El ítem "${item.nombre}" no corresponde al tipo de vehículo de esta inspección.`,
    );
  }

  // A2 del design: un ítem BINARIO solo acepta OK/FALLA, un ítem TRIESTADO
  // (fluidos) solo acepta BUENO/BAJO/MALO — nunca se mezclan los dos
  // conjuntos, sin importar qué mande el cliente.
  if (!valoresPermitidos(item.tipoRespuesta).includes(valor)) {
    throw new Error(`"${valor}" no es un valor válido para el ítem "${item.nombre}".`);
  }

  const observacionLimpia = observacion?.trim() || "";
  const ubicacionLimpia = ubicacion?.trim() || "";
  // `esNovedad` es true para FALLA (binario) y MALO (triestado) — BAJO queda
  // afuera a propósito (decisión confirmada: solo dato/observación, no
  // Novedad, no bloquea el envío). Ver lib/inspections/respuesta.ts.
  if (esNovedad(valor)) {
    if (!observacionLimpia) {
      throw new Error(
        item.pideUbicacion
          ? `Debés indicar dónde para el ítem "${item.nombre}".`
          : "Debés describir la novedad cuando el ítem queda en falla.",
      );
    }
    if (!tipo) {
      throw new Error("Debés indicar el tipo de novedad.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inspectionItemResponse.findUnique({
      where: { inspectionId_checklistItemId: { inspectionId, checklistItemId } },
      include: { novedad: true },
    });

    const saved = existing
      ? await tx.inspectionItemResponse.update({
          where: { id: existing.id },
          data: { valor, observacion: observacionLimpia || null },
        })
      : await tx.inspectionItemResponse.create({
          data: {
            inspectionId,
            checklistItemId,
            valor,
            observacion: observacionLimpia || null,
          },
        });

    if (existing?.novedad && !esNovedad(valor)) {
      await tx.photo.deleteMany({ where: { novedadId: existing.novedad.id } });
      await tx.novedad.delete({ where: { id: existing.novedad.id } });
    }

    let novedad = existing?.novedad ?? null;
    if (esNovedad(valor)) {
      const descripcionNovedad = item.pideUbicacion
        ? TIPO_NOVEDAD_LABELS[tipo!]
        : observacionLimpia;
      const ubicacionNovedad = item.pideUbicacion ? observacionLimpia || null : ubicacionLimpia || null;

      novedad = existing?.novedad
        ? await tx.novedad.update({
            where: { id: existing.novedad.id },
            data: { descripcion: descripcionNovedad, tipo: tipo!, ubicacion: ubicacionNovedad },
          })
        : await tx.novedad.create({
            data: {
              inspectionId,
              inspectionItemResponseId: saved.id,
              descripcion: descripcionNovedad,
              tipo: tipo!,
              ubicacion: ubicacionNovedad,
            },
          });
    }

    return { response: saved, novedad };
  });
}

// Además de fotos, se acepta PDF (ej. foto de un documento exportada como
// PDF desde el celular, o un comprobante ya digital) — pedido del dueño de
// producto: el conductor reporta la novedad desde el celular y a veces lo
// que tiene a mano es un documento, no una foto suelta.
const MIME_TYPES_PERMITIDOS_NOVEDAD = ["application/pdf"];

/**
 * Sube una foto o documento (desde `<input type="file">`, vía FormData con
 * el archivo en el campo "file") y la asocia a una Novedad existente. Los
 * adjuntos (`Photo`, el modelo no distingue tipo) solo se relacionan a una
 * Novedad, nunca sueltos. Una sola foto por novedad (pedido del dueño de
 * producto, ver app/(worker)/inspecciones/[id]/novedades/[novedadId]/foto/page.tsx
 * — esa pantalla ya oculta el formulario con una foto existente, esto es la
 * validación real de backend).
 */
export async function subirFotoNovedad(novedadId: string, formData: FormData) {
  const session = await requireRole([Role.TRABAJADOR]);

  const novedad = await prisma.novedad.findUnique({
    where: { id: novedadId },
    include: { inspection: true, photos: true },
  });
  if (!novedad || novedad.inspection.workerId !== session.user.id) {
    throw new ForbiddenError("Esta novedad no pertenece al usuario autenticado.");
  }
  if (novedad.inspection.status !== InspectionStatus.EN_PROCESO) {
    throw new Error("La inspección ya no está en proceso: no se pueden agregar adjuntos.");
  }
  if (novedad.photos.length > 0) {
    throw new Error("Esta novedad ya tiene una foto adjunta: no se pueden agregar más.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Debés seleccionar una foto o documento.");
  }
  const esImagen = file.type.startsWith("image/");
  const esDocumentoPermitido = MIME_TYPES_PERMITIDOS_NOVEDAD.includes(file.type);
  if (!esImagen && !esDocumentoPermitido) {
    throw new Error("El archivo debe ser una imagen o un PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const key = `novedades/${novedadId}/${randomUUID()}.${extension}`;

  await uploadObject({ key, body: buffer, contentType: file.type });

  return prisma.photo.create({
    data: { novedadId, s3Key: key },
  });
}

/**
 * Registra el resultado final: si el vehículo puede operar o no. Si no
 * puede, la justificación es obligatoria.
 */
export async function registrarResultado(
  inspectionId: string,
  puedeOperar: boolean,
  justificacion?: string,
) {
  const session = await requireRole([Role.TRABAJADOR]);
  await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  const justificacionLimpia = justificacion?.trim() || "";
  if (!puedeOperar && !justificacionLimpia) {
    throw new Error("La justificación es obligatoria cuando el vehículo no puede operar.");
  }

  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      puedeOperar,
      justificacionNoOperar: puedeOperar ? null : justificacionLimpia,
    },
  });
}

/**
 * Registra la declaración de estado del conductor (Fase soporte-moto-carro,
 * Slice 3, A6): 3 respuestas sí/no, una sola vez por inspección (se puede
 * volver a llamar mientras siga EN_PROCESO para corregir una respuesta, igual
 * que el resto de las mutaciones de este archivo — no hay motivo para
 * tratarla distinto). `declaracionEstadoAt` se fija con la hora del servidor,
 * nunca recibida del cliente. Ninguna combinación de respuestas bloquea nada
 * acá (D8, confirmado): una respuesta "preocupante" solo se refleja como
 * advertencia derivada para el Supervisor, ver
 * lib/inspections/estado-conductor.ts.
 */
export async function registrarEstadoConductor(
  inspectionId: string,
  data: { tomaMedicamentos: boolean; condicionesAptas: boolean; consumioAlcohol: boolean },
) {
  const session = await requireRole([Role.TRABAJADOR]);
  await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      tomaMedicamentos: data.tomaMedicamentos,
      condicionesAptas: data.condicionesAptas,
      consumioAlcohol: data.consumioAlcohol,
      declaracionEstadoAt: new Date(),
    },
  });
}

/**
 * Registra UNA respuesta de la declaración de estado del conductor: la
 * pantalla las muestra de a una (pedido del dueño de producto, 2026-09-18) y
 * cada respuesta se guarda sola, así se puede retomar a mitad de camino y
 * corregir una respuesta mientras la inspección siga EN_PROCESO. `campo` se
 * valida contra la lista de preguntas (nunca se escribe una columna arbitraria
 * de `Inspection`). `declaracionEstadoAt` se fija con la hora del servidor
 * cuando la respuesta deja completas las 3 preguntas. Ninguna combinación
 * bloquea nada (D8), igual que en `registrarEstadoConductor`.
 */
export async function registrarRespuestaEstadoConductor(
  inspectionId: string,
  campo: CampoEstadoConductor,
  valor: boolean,
) {
  const session = await requireRole([Role.TRABAJADOR]);
  const inspection = await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  if (!PREGUNTAS_ESTADO_CONDUCTOR.some((pregunta) => pregunta.campo === campo)) {
    throw new Error("La pregunta indicada no es parte de la declaración del conductor.");
  }

  const respuestas = {
    tomaMedicamentos: inspection.tomaMedicamentos,
    condicionesAptas: inspection.condicionesAptas,
    consumioAlcohol: inspection.consumioAlcohol,
    [campo]: valor,
  };
  const declaracionCompleta = Object.values(respuestas).every((respuesta) => respuesta !== null);

  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      [campo]: valor,
      ...(declaracionCompleta ? { declaracionEstadoAt: new Date() } : {}),
    },
  });
}

/**
 * Envía la inspección: valida que todos los ChecklistItem tengan respuesta,
 * que se haya registrado el resultado (`puedeOperar`) y que exista la firma
 * manuscrita del conductor (Fase D — validación real de backend, no solo de
 * UI: el botón de la pantalla de confirmar ya viene deshabilitado sin
 * firma, pero esto es lo que de verdad lo impide). Fija `completedAt` con
 * la hora del servidor y mueve el estado a PENDIENTE_APROBACION (si puede
 * operar) o NO_APTA_PARA_OPERAR (si no) — en ambos casos el Supervisor debe
 * poder revisarla igual en la fase siguiente. Una vez enviada, nunca se
 * vuelve a EN_PROCESO ni se borra.
 */
export async function enviarInspeccion(inspectionId: string) {
  const session = await requireRole([Role.TRABAJADOR]);
  const inspection = await getOwnInspeccionEnProceso(inspectionId, session.user.id);

  if (inspection.puedeOperar === null) {
    throw new Error("Falta registrar si el vehículo puede operar antes de enviar.");
  }

  const firmaConductor = await prisma.firma.findUnique({
    where: { inspectionId_tipo: { inspectionId, tipo: TipoFirma.CONDUCTOR } },
  });
  if (!firmaConductor) {
    throw new Error("Falta la firma del conductor antes de enviar.");
  }

  // El catálogo se filtra por el tipo del vehículo de esta inspección (A1) —
  // la validación de "faltan ítems por responder" de abajo debe compararse
  // contra el mismo subconjunto que el trabajador realmente vio, no contra
  // el catálogo completo de ambos tipos.
  //
  // Corrección Slice 2 (hallazgo CRITICAL #1, corroborado por 3 lentes de
  // revisión): esto era un conteo pelado (`responseCount < totalItems`), no
  // una comparación real de qué ítems faltan. Un ítem de OTRO tipo de
  // vehículo colado en `inspectionItemResponse` (ver guarda agregada en
  // `responderItem` arriba) inflaba `responseCount` sin cubrir un ítem
  // realmente obligatorio, dejando pasar el envío. Ahora se compara por
  // diferencia de conjuntos de IDs: se resuelven los IDs requeridos del
  // catálogo scoped por tipo y se verifica que cada uno tenga una respuesta
  // real, sin importar cuántas respuestas "de más" (de otro tipo) existan.
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: inspection.vehicleId },
    select: { tipoVehiculo: true },
  });
  const catalog = await getChecklistCatalog(vehicle?.tipoVehiculo ?? TipoVehiculo.MOTO);
  const itemsRequeridos = catalog.flatMap((category) => category.items);
  const idsRequeridos = itemsRequeridos.map((item) => item.id);
  const responses = await prisma.inspectionItemResponse.findMany({
    where: { inspectionId, checklistItemId: { in: idsRequeridos } },
    select: { checklistItemId: true },
  });
  const idsRespondidos = new Set(responses.map((response) => response.checklistItemId));
  const itemsFaltantes = itemsRequeridos.filter((item) => !idsRespondidos.has(item.id));
  if (itemsFaltantes.length > 0) {
    const nombresFaltantes = itemsFaltantes.map((item) => item.nombre).join(", ");
    throw new Error(`Faltan ítems del checklist por responder: ${nombresFaltantes}.`);
  }

  // Fase soporte-moto-carro (Slice 3, spec daily-vehicle-photos): las 2
  // fotos diarias (LATERAL/PLACA) son obligatorias, independiente del
  // resultado del checklist. Mismo criterio de diferencia de conjuntos que
  // arriba (por tipo, no por cantidad) — con solo 2 tipos posibles alcanza
  // con nombrarlos directo en el mensaje de error.
  const fotos = await prisma.fotoInspeccion.findMany({
    where: { inspectionId, tipo: { in: FOTOS_DIARIAS_REQUERIDAS } },
    select: { tipo: true },
  });
  const tiposConFoto = new Set(fotos.map((foto) => foto.tipo));
  const fotosFaltantes = FOTOS_DIARIAS_REQUERIDAS.filter((tipo) => !tiposConFoto.has(tipo));
  if (fotosFaltantes.length > 0) {
    throw new Error(`Faltan fotos obligatorias: ${fotosFaltantes.join(", ")}.`);
  }

  // Fase soporte-moto-carro (Slice 3, spec driver-state-declaration): las 3
  // respuestas deben estar completas (no-null) antes de enviar, pero
  // NINGUNA combinación de valores bloquea el envío (D8) — eso es
  // responsabilidad exclusiva de `requiereAtencionEstadoConductor`
  // (lib/inspections/estado-conductor.ts), que solo decide si el Supervisor
  // ve una advertencia, nunca si se puede enviar.
  if (
    inspection.tomaMedicamentos === null ||
    inspection.condicionesAptas === null ||
    inspection.consumioAlcohol === null
  ) {
    throw new Error("Falta completar la declaración de estado del conductor antes de enviar.");
  }

  const status = inspection.puedeOperar
    ? InspectionStatus.PENDIENTE_APROBACION
    : InspectionStatus.NO_APTA_PARA_OPERAR;

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status, completedAt: new Date() },
  });

  await logAudit({
    userId: session.user.id,
    action: "ENVIAR_INSPECCION",
    entityType: "Inspection",
    entityId: inspection.id,
    metadata: { status, puedeOperar: inspection.puedeOperar },
  });

  return updated;
}
