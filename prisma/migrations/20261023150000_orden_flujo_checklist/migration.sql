-- Orden global del recorrido guiado (feature checklist-bueno-malo).
--
-- `ChecklistItem.orden` pasa a ser el orden del recorrido de TODO el checklist
-- (no solo dentro de su categoría), para poder intercalar ítems de distintas
-- categorías: Luces, Llantas, Aceite, Líquido de frenos, Frenos, Refrigerante,
-- Espejos, ... "Documentación" no cambia: va siempre primero, como una lista.
--
-- Solo UPDATE por (categoría, nombre): no renombra, no crea ni borra ítems, y
-- es idempotente (valores absolutos). Los mismos números están en
-- prisma/catalogo-checklist.ts (hay un test que verifica que coincidan).
UPDATE "ChecklistItem" AS i
SET "orden" = v."orden"
FROM (VALUES
  ('Inspección Visual', 'Luces externas con direccionales', 10),
  ('Inspección Visual', 'Luces altas, bajas, reversa e internas con direccionales', 11),
  ('Inspección Visual', 'Llantas', 20),
  ('Inspección Visual', 'Llantas, incluye repuesto', 21),
  ('Fluidos', 'Nivel de aceite', 30),
  ('Fluidos', 'Nivel líquido de frenos', 40),
  ('Inspección Visual', 'Frenos', 50),
  ('Fluidos', 'Nivel refrigerante', 60),
  ('Inspección Visual', 'Cinturones de seguridad', 70),
  ('Inspección Visual', 'Limpiabrisas', 80),
  ('Inspección Visual', 'Espejos', 90),
  ('Equipo de prevención', 'Botiquín', 100),
  ('Equipo de prevención', 'Extintor', 110),
  ('Equipo de prevención', 'Canguro de emergencia vial', 120),
  ('Inspección Visual', 'Casco', 130)
) AS v("categoria", "nombre", "orden")
JOIN "ChecklistCategory" AS c ON c."nombre" = v."categoria"
WHERE i."categoryId" = c."id" AND i."nombre" = v."nombre";
