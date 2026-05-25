-- ════════════════════════════════════════════════════════════════════
--  CRM v30 — Banco de cláusulas do contrato (Fase A)
--
--  Cada corretor mantém seu conjunto de cláusulas reutilizáveis.
--  Tipos definem em quais modelos de contrato a cláusula entra:
--    generica       — vai em todos os contratos
--    caucao         — só quando garantia = caução
--    fiador         — só quando garantia = fiador
--    seguro_fianca  — só quando garantia = seguro fiança
--    seguro_incendio — só quando contratado seguro de incêndio
--    adicional      — opcional, escolhida caso a caso na geração
--
--  Categoria + número definem a ordem dentro do contrato (objeto,
--  prazo, aluguel, reajuste, mora, garantia, etc.).
--
--  O corpo aceita placeholders no formato {{NOME_DA_VARIAVEL}}, que
--  serão substituídos na geração do PDF pelos dados do contrato real.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrato_clausulas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
              CHECK (tipo IN ('generica','caucao','fiador','seguro_fianca','seguro_incendio','adicional')),
  categoria   TEXT NOT NULL,    -- ex: 'objeto','prazo','aluguel','reajuste','mora','garantia','foro'
  titulo      TEXT NOT NULL,    -- ex: "Do objeto da locação"
  numero      INTEGER NOT NULL DEFAULT 0,
  corpo       TEXT NOT NULL,    -- texto da cláusula, com placeholders {{LOCADOR_NOME}} etc.
  ativa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contrato_clausulas_user_tipo_idx
  ON contrato_clausulas (user_id, tipo, numero);

CREATE INDEX IF NOT EXISTS contrato_clausulas_ativas_idx
  ON contrato_clausulas (user_id, tipo)
  WHERE ativa = TRUE;

ALTER TABLE contrato_clausulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contrato_clausulas_owner ON contrato_clausulas;
CREATE POLICY contrato_clausulas_owner ON contrato_clausulas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Atualiza updated_at em UPDATE
CREATE OR REPLACE FUNCTION contrato_clausulas_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contrato_clausulas_updated_at ON contrato_clausulas;
CREATE TRIGGER contrato_clausulas_updated_at
  BEFORE UPDATE ON contrato_clausulas
  FOR EACH ROW EXECUTE FUNCTION contrato_clausulas_touch_updated_at();

NOTIFY pgrst, 'reload schema';
