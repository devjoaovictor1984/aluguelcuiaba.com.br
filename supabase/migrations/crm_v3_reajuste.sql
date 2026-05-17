-- ════════════════════════════════════════════════════════════════════
--  CRM v3 — Reajuste de aluguel
--  Histórico de reajustes aplicados (auditoria) + RLS.
--  As parcelas não pagas são reescritas pelo backend.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reajustes_historico (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id     UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_aplicado   DATE NOT NULL DEFAULT CURRENT_DATE,
  data_efetiva    DATE NOT NULL,           -- a partir de qual mês de referência vale
  valor_antigo    NUMERIC(12,2) NOT NULL,
  valor_novo      NUMERIC(12,2) NOT NULL,
  percentual      NUMERIC(7,4) NOT NULL,   -- valor_novo / valor_antigo - 1 (em %)
  indice_usado    TEXT,                    -- IGPM, IPCA, INPC, manual
  parcelas_afetadas INTEGER NOT NULL DEFAULT 0,
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reajustes_contrato_idx
  ON reajustes_historico (contrato_id);

ALTER TABLE reajustes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reajustes_select ON reajustes_historico;
CREATE POLICY reajustes_select ON reajustes_historico
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS reajustes_insert ON reajustes_historico;
CREATE POLICY reajustes_insert ON reajustes_historico
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reajustes_delete ON reajustes_historico;
CREATE POLICY reajustes_delete ON reajustes_historico
  FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
