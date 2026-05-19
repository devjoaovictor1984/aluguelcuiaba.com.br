-- ════════════════════════════════════════════════════════════════════
--  CRM v15 — Coluna posts.visualizacoes
--  Garante a coluna usada pelo Dashboard admin (Top 10 posts + soma
--  total de views). Idempotente. Se a coluna já existe, não faz nada.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS visualizacoes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS posts_visualizacoes_idx
  ON posts (visualizacoes DESC)
  WHERE publicado = true;

NOTIFY pgrst, 'reload schema';
