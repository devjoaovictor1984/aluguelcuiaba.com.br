-- ════════════════════════════════════════════════════════════════════
--  CRM v41 — Capa executiva do contrato (página 1 do PDF)
--
--  Página de capa com partes + imóvel + resumo financeiro antes das
--  cláusulas. Default ON. Usuário pode desligar por geração.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS incluir_capa BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN contrato_geracoes.incluir_capa IS
  'Quando TRUE, o PDF começa com uma página de capa executiva (partes + imóvel + resumo). Default TRUE.';
