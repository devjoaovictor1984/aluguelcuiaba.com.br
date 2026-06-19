-- ════════════════════════════════════════════════════════════════════
--  CRM v58 — Termos aditivos ao contrato de ADMINISTRAÇÃO
--
--  Espelha contratos_aditivos (locação), mas referenciando o contrato de
--  administração. Tipos voltados à relação administradora ↔ proprietária:
--  taxa, prorrogação, exclusividade, repasse, cláusula, outro.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contratos_administracao_aditivos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   UUID NOT NULL REFERENCES contratos_administracao(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  numero        INTEGER NOT NULL DEFAULT 1,
  data_aditivo  DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo          TEXT NOT NULL DEFAULT 'outro'
                CHECK (tipo IN ('taxa','prorrogacao','exclusividade','repasse','clausula','outro')),
  titulo        TEXT,
  objeto        TEXT NOT NULL CHECK (length(trim(objeto)) > 0),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aditivos_adm_contrato
  ON contratos_administracao_aditivos(contrato_id, numero);

ALTER TABLE contratos_administracao_aditivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aditivos_adm_select_own ON contratos_administracao_aditivos;
CREATE POLICY aditivos_adm_select_own ON contratos_administracao_aditivos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_adm_insert_own ON contratos_administracao_aditivos;
CREATE POLICY aditivos_adm_insert_own ON contratos_administracao_aditivos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_adm_update_own ON contratos_administracao_aditivos;
CREATE POLICY aditivos_adm_update_own ON contratos_administracao_aditivos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_adm_delete_own ON contratos_administracao_aditivos;
CREATE POLICY aditivos_adm_delete_own ON contratos_administracao_aditivos
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
