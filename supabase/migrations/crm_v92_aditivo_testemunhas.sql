-- ─────────────────────────────────────────────────────────────────────
-- v92 · Termo aditivo editável, com testemunhas
--
-- POR QUE: o aditivo nascia pronto (o do reajuste sai gerado sozinho) e
-- não tinha como mexer depois — nem no texto, nem nas testemunhas. O PDF
-- saía sempre com as duas linhas de testemunha em branco.
--
-- testemunha_ids: mesmo desenho de contrato_geracoes.testemunha_ids
-- (v33). Até 2 IDs em pessoas, que aparecem com nome, CPF e RG na folha
-- de assinatura do PDF.
--
-- updated_at: pra saber que o texto gerado foi revisado à mão.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_aditivos
  ADD COLUMN IF NOT EXISTS testemunha_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ;

COMMENT ON COLUMN contratos_aditivos.testemunha_ids IS
  'IDs em pessoas das testemunhas que aparecem pré-preenchidas na folha de assinatura do aditivo. Máx. 2.';
COMMENT ON COLUMN contratos_aditivos.updated_at IS
  'Última edição do aditivo. NULL = nunca editado depois de criado.';

NOTIFY pgrst, 'reload schema';
