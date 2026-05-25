-- ════════════════════════════════════════════════════════════════════
--  CRM v31 — Tipo 'sem_garantia' em contrato_clausulas
--
--  A v30 cobria caução, fiador, seguro fiança e seguro incêndio, mas
--  faltava o caso explícito de locação SEM garantia — que exige uma
--  cláusula própria deixando claro o regime e suas consequências.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_clausulas
  DROP CONSTRAINT IF EXISTS contrato_clausulas_tipo_check;

ALTER TABLE contrato_clausulas
  ADD CONSTRAINT contrato_clausulas_tipo_check
  CHECK (tipo IN (
    'generica',
    'sem_garantia',
    'caucao',
    'fiador',
    'seguro_fianca',
    'seguro_incendio',
    'adicional'
  ));

NOTIFY pgrst, 'reload schema';
