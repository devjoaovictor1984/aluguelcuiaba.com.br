-- ════════════════════════════════════════════════════════════════════
--  CRM v8 — Soft delete
--  Em vez de deletar, marca deleted_at. Permite restaurar e
--  preserva histórico/audit log até purge automático após 30 dias.
-- ════════════════════════════════════════════════════════════════════

-- Coluna deleted_at nas tabelas que aceitam soft delete
ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pessoas_documentos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices parciais aceleram listagens "não deletados"
CREATE INDEX IF NOT EXISTS pessoas_ativas_idx
  ON pessoas (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contratos_ativos_idx
  ON contratos_locacao (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pessoas_documentos_ativos_idx
  ON pessoas_documentos (user_id) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
