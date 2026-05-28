-- ════════════════════════════════════════════════════════════════════
--  CRM v44 — Tipo de cláusula 'finalidade' (objeto/destinação por uso)
--
--  Variantes de "Do objeto" e "Da destinação" conforme a finalidade do
--  contrato (residencial / comercial / misto). As genéricas continuam
--  servindo o caso residencial; comercial e misto usam estas variantes.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_clausulas
  DROP CONSTRAINT IF EXISTS contrato_clausulas_tipo_check;

ALTER TABLE contrato_clausulas
  ADD CONSTRAINT contrato_clausulas_tipo_check
  CHECK (tipo IN (
    'generica','sem_garantia','caucao','fiador','seguro_fianca','seguro_incendio',
    'adicional','administracao','atuacao','fundamentacao','mobilia','pet',
    'aluguel_pacote','finalidade'
  ));

NOTIFY pgrst, 'reload schema';
