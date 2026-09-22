-- ─────────────────────────────────────────────────────────────────────
-- v102 · Sinistro do seguro fiança: quem pagou a parcela
--
-- POR QUE: quando o locatário para de pagar e o seguro fiança cobre, a
-- parcela É paga — o proprietário recebe e o repasse acontece. Mas hoje
-- o CRM só sabe dizer "pago", e o recibo sai em nome do locatário, como
-- se o dinheiro tivesse vindo dele. Não veio. Ele passou a dever à
-- seguradora, que cobra por fora (direito de regresso, e a cláusula do
-- contrato já diz isso).
--
-- Duas coisas novas:
--
--   contrato_sinistros — o episódio: seguradora, número, quando abriu,
--     quando encerrou. Um aberto por contrato de cada vez (índice único
--     parcial): dois sinistros abertos no mesmo contrato ao mesmo tempo
--     é sempre erro de digitação, e o segundo esconderia o primeiro.
--
--   parcelas_aluguel.pago_por — 'locatario' (o padrão de sempre) ou
--     'seguradora', com sinistro_id apontando pro episódio. É por essa
--     coluna que o recibo sabe que não deve sair, e que o financeiro
--     sabe separar o que entrou de quem.
--
-- ENCERRAR o sinistro não mexe em parcela nenhuma já paga: o que a
-- seguradora cobriu continua sendo dela para cobrar do locatário. O
-- encerramento só diz que as PRÓXIMAS voltam a ser cobradas dele.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contrato_sinistros (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id  UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  seguradora   TEXT,
  numero       TEXT,                                    -- nº do sinistro na seguradora
  aberto_em    DATE NOT NULL DEFAULT CURRENT_DATE,
  encerrado_em DATE,
  status       TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','encerrado')),
  motivo       TEXT,                                    -- por que abriu
  observacoes  TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um sinistro aberto por contrato.
CREATE UNIQUE INDEX IF NOT EXISTS contrato_sinistros_um_aberto
  ON contrato_sinistros (contrato_id) WHERE status = 'aberto';

CREATE INDEX IF NOT EXISTS contrato_sinistros_contrato_idx
  ON contrato_sinistros (contrato_id, aberto_em DESC);

ALTER TABLE contrato_sinistros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sinistros_select_own ON contrato_sinistros;
CREATE POLICY sinistros_select_own ON contrato_sinistros
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS sinistros_insert_own ON contrato_sinistros;
CREATE POLICY sinistros_insert_own ON contrato_sinistros
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sinistros_update_own ON contrato_sinistros;
CREATE POLICY sinistros_update_own ON contrato_sinistros
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS sinistros_delete_own ON contrato_sinistros;
CREATE POLICY sinistros_delete_own ON contrato_sinistros
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Quem pagou a parcela ─────────────────────────────────────────────
ALTER TABLE parcelas_aluguel
  ADD COLUMN IF NOT EXISTS pago_por    TEXT NOT NULL DEFAULT 'locatario',
  ADD COLUMN IF NOT EXISTS sinistro_id UUID REFERENCES contrato_sinistros(id) ON DELETE SET NULL;

ALTER TABLE parcelas_aluguel DROP CONSTRAINT IF EXISTS parcelas_aluguel_pago_por_check;
ALTER TABLE parcelas_aluguel
  ADD CONSTRAINT parcelas_aluguel_pago_por_check
  CHECK (pago_por IN ('locatario','seguradora'));

CREATE INDEX IF NOT EXISTS parcelas_sinistro_idx
  ON parcelas_aluguel (sinistro_id) WHERE sinistro_id IS NOT NULL;

COMMENT ON COLUMN parcelas_aluguel.pago_por IS
  'Quem pagou: locatario (padrão) ou seguradora, em sinistro coberto. Parcela paga pela seguradora não gera recibo para o locatário — ele passou a dever à seguradora.';

-- ── Timeline ─────────────────────────────────────────────────────────
-- A v7 registra tudo por trigger, com a lista de tipos presa num CHECK.
-- Abrir e encerrar sinistro são eventos do contrato como qualquer outro,
-- então entram na mesma lista e no mesmo lugar.

ALTER TABLE eventos_contrato DROP CONSTRAINT IF EXISTS eventos_contrato_tipo_check;
ALTER TABLE eventos_contrato
  ADD CONSTRAINT eventos_contrato_tipo_check CHECK (tipo IN (
    'contrato_criado','contrato_atualizado','contrato_encerrado','contrato_renovado',
    'pagamento_registrado','pagamento_desfeito',
    'repasse_pago','repasse_desfeito',
    'seguro_pago','seguro_desfeito',
    'boleto_enviado','boleto_desfeito',
    'reajuste_aplicado','parcelas_regeneradas',
    'morador_adicionado','morador_removido',
    'documento_pessoal_anexado','documento_pessoal_removido',
    'observacao_manual',
    'sinistro_aberto','sinistro_encerrado'
  ));

CREATE OR REPLACE FUNCTION trg_log_sinistro()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM registrar_evento_contrato(
      NEW.contrato_id, 'sinistro_aberto',
      'Sinistro aberto' || COALESCE(' na ' || NEW.seguradora, '') || COALESCE(' · nº ' || NEW.numero, ''),
      jsonb_build_object('sinistro_id', NEW.id, 'seguradora', NEW.seguradora,
                         'numero', NEW.numero, 'aberto_em', NEW.aberto_em)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'aberto' AND NEW.status = 'encerrado' THEN
    PERFORM registrar_evento_contrato(
      NEW.contrato_id, 'sinistro_encerrado',
      'Sinistro encerrado — locatário voltou a pagar' || COALESCE(' · ' || NEW.motivo, ''),
      jsonb_build_object('sinistro_id', NEW.id, 'encerrado_em', NEW.encerrado_em)
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_sinistro_ins ON contrato_sinistros;
CREATE TRIGGER trg_log_sinistro_ins
  AFTER INSERT ON contrato_sinistros
  FOR EACH ROW EXECUTE FUNCTION trg_log_sinistro();

DROP TRIGGER IF EXISTS trg_log_sinistro_upd ON contrato_sinistros;
CREATE TRIGGER trg_log_sinistro_upd
  AFTER UPDATE ON contrato_sinistros
  FOR EACH ROW EXECUTE FUNCTION trg_log_sinistro();

NOTIFY pgrst, 'reload schema';
