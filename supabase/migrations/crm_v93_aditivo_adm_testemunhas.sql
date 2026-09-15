-- ─────────────────────────────────────────────────────────────────────
-- v93 · Termo aditivo da ADMINISTRAÇÃO editável, com testemunhas
--
-- Espelha a v92 (aditivo de locação) em contratos_administracao_aditivos:
-- o aditivo passa a ser editável depois de criado, e o PDF sai com as
-- testemunhas escolhidas em vez das linhas em branco.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_administracao_aditivos
  ADD COLUMN IF NOT EXISTS testemunha_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ;

COMMENT ON COLUMN contratos_administracao_aditivos.testemunha_ids IS
  'IDs em pessoas das testemunhas que aparecem pré-preenchidas na folha de assinatura do aditivo. Máx. 2.';
COMMENT ON COLUMN contratos_administracao_aditivos.updated_at IS
  'Última edição do aditivo. NULL = nunca editado depois de criado.';

NOTIFY pgrst, 'reload schema';
