-- ════════════════════════════════════════════════════════════════════
--  CRM v42 — Finalidade do contrato (residencial / comercial / misto)
--
--  Afeta o título do PDF, a capa executiva e (futuramente) variantes das
--  cláusulas de objeto e destinação. Default residencial — pode ser
--  trocado no wizard ou na edição do contrato.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS finalidade TEXT NOT NULL DEFAULT 'residencial'
    CHECK (finalidade IN ('residencial', 'comercial', 'misto'));

COMMENT ON COLUMN contratos_locacao.finalidade IS
  'residencial = moradia; comercial = atividade empresarial; misto = ambos (ex: home-office com atendimento).';
