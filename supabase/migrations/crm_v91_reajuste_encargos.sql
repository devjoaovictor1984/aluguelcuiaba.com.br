-- ─────────────────────────────────────────────────────────────────────
-- v91 · Reajuste também de IPTU e condomínio
--
-- POR QUE: o reajuste só mexia no aluguel. Na prática, quando vira o
-- ano o IPTU muda junto — é lançamento novo da prefeitura — e o
-- condomínio idem. Sem campo, o corretor reajustava o aluguel aqui e
-- corrigia o IPTU na mão em cada parcela, ou simplesmente deixava
-- errado até alguém reclamar.
--
-- São valores separados de propósito, e não um total: o aluguel é
-- receita da locação e base da comissão; IPTU e condomínio são encargo
-- do proprietário, que a imobiliária só cobra junto e repassa. Somar os
-- três num número só quebraria a comissão e o repasse.
--
-- Colunas anuláveis: reajuste que não mexe no encargo grava NULL, e a
-- diferença entre "não mexeu" e "zerou" continua legível no histórico.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE reajustes_historico
  ADD COLUMN IF NOT EXISTS iptu_antigo        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS iptu_novo          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS condominio_antigo  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS condominio_novo    NUMERIC(12,2);

COMMENT ON COLUMN reajustes_historico.iptu_antigo IS
  'IPTU mensal antes deste reajuste. NULL quando o reajuste não mexeu no IPTU.';
COMMENT ON COLUMN reajustes_historico.iptu_novo IS
  'IPTU mensal depois deste reajuste. NULL quando o reajuste não mexeu no IPTU.';
COMMENT ON COLUMN reajustes_historico.condominio_antigo IS
  'Condomínio mensal antes deste reajuste. NULL quando o reajuste não mexeu no condomínio.';
COMMENT ON COLUMN reajustes_historico.condominio_novo IS
  'Condomínio mensal depois deste reajuste. NULL quando o reajuste não mexeu no condomínio.';

NOTIFY pgrst, 'reload schema';
