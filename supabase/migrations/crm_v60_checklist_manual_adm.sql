-- ════════════════════════════════════════════════════════════════════
--  CRM v60 — Checklist manual do contrato de administração
--
--  Além do checklist automático (que infere pela presença de dados/cláusulas),
--  o corretor pode CONFIRMAR manualmente cada item essencial do contrato.
--  Guardado como JSONB { item_key: true } no próprio contrato. Aditivo.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_administracao
  ADD COLUMN IF NOT EXISTS checklist_manual JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN contratos_administracao.checklist_manual IS
  'Itens essenciais confirmados manualmente pelo corretor (mapa item_key -> true).';

NOTIFY pgrst, 'reload schema';
