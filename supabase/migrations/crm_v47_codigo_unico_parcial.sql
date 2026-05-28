-- ════════════════════════════════════════════════════════════════════
--  CRM v47 — Numeração de contrato reaproveita códigos de apagados
--
--  Antes: UNIQUE (user_id, codigo) total — contratos soft-deleted (lixeira)
--  ocupavam o número pra sempre, fazendo a sequência pular (ex: apagou
--  017–026 de teste, próximo virava 027).
--
--  Agora: unique PARCIAL (só entre contratos ativos). A numeração continua
--  do último contrato ATIVO e pode reusar números de testes apagados.
-- ════════════════════════════════════════════════════════════════════

-- Remove a constraint unique total (nome padrão gerado pelo Postgres)
ALTER TABLE contratos_locacao
  DROP CONSTRAINT IF EXISTS contratos_locacao_user_id_codigo_key;

-- Unique apenas entre contratos não apagados
CREATE UNIQUE INDEX IF NOT EXISTS contratos_locacao_user_codigo_ativo_idx
  ON contratos_locacao (user_id, codigo)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
