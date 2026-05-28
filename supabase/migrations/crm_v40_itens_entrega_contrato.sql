-- ════════════════════════════════════════════════════════════════════
--  CRM v40 — Itens entregues na posse (chaves, controles, tags)
--
--  Vão pro Termo de Entrega de Chaves no PDF do contrato. Antes ficavam
--  zerados e renderizados como "_____" pra preencher à mão.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS qtd_chaves    INTEGER NOT NULL DEFAULT 0 CHECK (qtd_chaves    >= 0),
  ADD COLUMN IF NOT EXISTS qtd_controles INTEGER NOT NULL DEFAULT 0 CHECK (qtd_controles >= 0),
  ADD COLUMN IF NOT EXISTS qtd_tags      INTEGER NOT NULL DEFAULT 0 CHECK (qtd_tags      >= 0);

COMMENT ON COLUMN contratos_locacao.qtd_chaves    IS 'Chaves entregues ao locatário';
COMMENT ON COLUMN contratos_locacao.qtd_controles IS 'Controles remotos (portão, garagem) entregues';
COMMENT ON COLUMN contratos_locacao.qtd_tags      IS 'Tags/cartões de acesso entregues';
