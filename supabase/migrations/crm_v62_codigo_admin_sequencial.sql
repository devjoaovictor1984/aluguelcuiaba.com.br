-- ════════════════════════════════════════════════════════════════════
--  CRM v62 — Código sequencial do contrato de administração
--
--  O código (ADM2026-001) passa a ser sequencial (primeiro número livre),
--  como na locação. Pra permitir reusar o número de um contrato excluído,
--  o UNIQUE (user_id, codigo) — que contava apagados — vira índice único
--  PARCIAL (só os não-apagados).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_administracao
  DROP CONSTRAINT IF EXISTS contratos_administracao_user_id_codigo_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contratos_admin_codigo_ativo
  ON contratos_administracao (user_id, codigo)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
