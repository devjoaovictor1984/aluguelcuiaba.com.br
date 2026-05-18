-- ════════════════════════════════════════════════════════════════════
--  CRM v10 — Admin user management (ban + reset + delete)
--  Adiciona colunas pra que o admin possa banir usuários sem apagar
--  dados. Reset de senha não precisa de coluna (Supabase Auth gere).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS banido_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banido_motivo  TEXT;

-- Índice parcial: a maioria dos usuários não está banida, então o índice
-- só lista quem está. Útil para auditoria.
CREATE INDEX IF NOT EXISTS perfis_banidos_idx
  ON perfis (banido_em DESC)
  WHERE banido_em IS NOT NULL;

NOTIFY pgrst, 'reload schema';
