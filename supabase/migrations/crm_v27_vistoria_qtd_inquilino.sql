-- ════════════════════════════════════════════════════════════════════
--  CRM v27 — Quantidades contestadas pelo inquilino
--
--  O corretor declara X chaves e Y controles na vistoria.
--  O inquilino, ao receber e conferir, pode dizer "recebi quantidades
--  diferentes". Em vez de sobrescrever a quantidade original (que
--  apagaria a evidência da divergência), guardamos a versão dele em
--  colunas separadas. NULL = não contestou; preenchido = contestou.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS qtd_chaves_inquilino    INTEGER,
  ADD COLUMN IF NOT EXISTS qtd_controles_inquilino INTEGER;

COMMENT ON COLUMN vistorias.qtd_chaves_inquilino IS
  'Quantidade de chaves confirmada pelo inquilino via link público. NULL = não contestou; valor = divergência registrada.';
COMMENT ON COLUMN vistorias.qtd_controles_inquilino IS
  'Quantidade de controles confirmada pelo inquilino via link público. NULL = não contestou.';

NOTIFY pgrst, 'reload schema';
