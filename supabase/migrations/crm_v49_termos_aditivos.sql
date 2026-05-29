-- ════════════════════════════════════════════════════════════════════
--  CRM v49 — Termos aditivos ao contrato de locação
--
--  Depois de assinado, o contrato pode precisar de alterações (reajuste
--  fora de época, prorrogação de prazo, troca de garantia, inclusão de
--  cláusula). O termo aditivo referencia o contrato original, registra
--  o que muda e é assinado pelas partes, nos termos da Lei 8.245/91.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contratos_aditivos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  numero        INTEGER NOT NULL DEFAULT 1,            -- 1º, 2º aditivo do contrato
  data_aditivo  DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo          TEXT NOT NULL DEFAULT 'outro'
                CHECK (tipo IN ('reajuste','prorrogacao','garantia','valor','clausula','outro')),
  titulo        TEXT,                                  -- ex: "Prorrogação de prazo"
  objeto        TEXT NOT NULL CHECK (length(trim(objeto)) > 0),  -- o que está sendo aditado

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aditivos_contrato
  ON contratos_aditivos(contrato_id, numero);

ALTER TABLE contratos_aditivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aditivos_select_own ON contratos_aditivos;
CREATE POLICY aditivos_select_own ON contratos_aditivos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_insert_own ON contratos_aditivos;
CREATE POLICY aditivos_insert_own ON contratos_aditivos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_update_own ON contratos_aditivos;
CREATE POLICY aditivos_update_own ON contratos_aditivos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS aditivos_delete_own ON contratos_aditivos;
CREATE POLICY aditivos_delete_own ON contratos_aditivos
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
