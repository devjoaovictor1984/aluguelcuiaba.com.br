-- ════════════════════════════════════════════════════════════════════
--  CRM v13 — Liberar imóveis alugados (janela 30d) para visitantes
--
--  Sintoma: mesmo com data_alugado dentro da janela, o imóvel não
--  aparece no site público em aba anônima. A query no código já filtra
--  certinho, MAS a Row Level Security do banco corta antes — a policy
--  original de SELECT permite só status='ativo'.
--
--  Como PostgreSQL faz OR entre policies de SELECT, basta adicionar
--  uma policy nova que libera alugados recentes — quem já estava ativo
--  continua passando pela policy antiga.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS imoveis_publico_alugados_30d ON imoveis;
CREATE POLICY imoveis_publico_alugados_30d ON imoveis
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'alugado'
    AND data_alugado IS NOT NULL
    AND data_alugado > NOW() - INTERVAL '30 days'
  );

NOTIFY pgrst, 'reload schema';
