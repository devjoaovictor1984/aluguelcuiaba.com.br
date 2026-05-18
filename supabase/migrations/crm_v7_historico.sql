-- ════════════════════════════════════════════════════════════════════
--  CRM v7 — Histórico de eventos (audit log)
--  Cada mudança importante no contrato/parcelas gera um registro.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eventos_contrato (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN (
    'contrato_criado','contrato_atualizado','contrato_encerrado','contrato_renovado',
    'pagamento_registrado','pagamento_desfeito',
    'repasse_pago','repasse_desfeito',
    'seguro_pago','seguro_desfeito',
    'boleto_enviado','boleto_desfeito',
    'reajuste_aplicado','parcelas_regeneradas',
    'morador_adicionado','morador_removido',
    'documento_pessoal_anexado','documento_pessoal_removido',
    'observacao_manual'
  )),
  descricao   TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eventos_contrato_contrato_idx
  ON eventos_contrato (contrato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS eventos_contrato_user_idx
  ON eventos_contrato (user_id);

ALTER TABLE eventos_contrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_contrato_select ON eventos_contrato;
CREATE POLICY eventos_contrato_select ON eventos_contrato
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS eventos_contrato_insert ON eventos_contrato;
CREATE POLICY eventos_contrato_insert ON eventos_contrato
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Triggers automáticos
-- ─────────────────────────────────────────────────────────────────────

-- Helper: pega user_id do contrato pra registrar com SECURITY DEFINER
CREATE OR REPLACE FUNCTION registrar_evento_contrato(
  p_contrato_id UUID,
  p_tipo TEXT,
  p_descricao TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  contrato_user_id UUID;
BEGIN
  SELECT user_id INTO contrato_user_id FROM contratos_locacao WHERE id = p_contrato_id;
  IF contrato_user_id IS NULL THEN RETURN; END IF;

  INSERT INTO eventos_contrato (contrato_id, user_id, tipo, descricao, metadata)
  VALUES (p_contrato_id, contrato_user_id, p_tipo, p_descricao, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger em contratos_locacao
CREATE OR REPLACE FUNCTION trg_log_contrato()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM registrar_evento_contrato(
      NEW.id, 'contrato_criado',
      'Contrato ' || NEW.codigo || ' criado',
      jsonb_build_object('valor_aluguel', NEW.valor_aluguel, 'duracao', NEW.duracao_meses)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Mudança de status
    IF OLD.status <> NEW.status THEN
      IF NEW.status IN ('encerrado', 'rescindido') THEN
        PERFORM registrar_evento_contrato(
          NEW.id, 'contrato_encerrado',
          'Contrato ' || NEW.status || COALESCE(' — ' || NEW.motivo_encerramento, ''),
          jsonb_build_object('status', NEW.status, 'motivo', NEW.motivo_encerramento, 'data', NEW.data_encerramento)
        );
      ELSE
        PERFORM registrar_evento_contrato(
          NEW.id, 'contrato_atualizado',
          'Status alterado de ' || OLD.status || ' para ' || NEW.status,
          jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status)
        );
      END IF;
    END IF;
    -- Mudança de valor (reajuste é registrado separadamente)
    IF OLD.valor_aluguel <> NEW.valor_aluguel AND TG_ARGV[0] IS NULL THEN
      -- Não duplica se for via aplicarReajuste (que registra direto). Aqui é mudança manual.
      PERFORM registrar_evento_contrato(
        NEW.id, 'contrato_atualizado',
        'Valor de referência: R$ ' || OLD.valor_aluguel || ' → R$ ' || NEW.valor_aluguel,
        jsonb_build_object('antes', OLD.valor_aluguel, 'depois', NEW.valor_aluguel)
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_contrato_ins ON contratos_locacao;
CREATE TRIGGER trg_log_contrato_ins
  AFTER INSERT ON contratos_locacao
  FOR EACH ROW EXECUTE FUNCTION trg_log_contrato();

DROP TRIGGER IF EXISTS trg_log_contrato_upd ON contratos_locacao;
CREATE TRIGGER trg_log_contrato_upd
  AFTER UPDATE ON contratos_locacao
  FOR EACH ROW EXECUTE FUNCTION trg_log_contrato();

-- Trigger em parcelas_aluguel
CREATE OR REPLACE FUNCTION trg_log_parcela()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NULL; END IF;

  -- Pagamento
  IF OLD.status_pagamento <> 'pago' AND NEW.status_pagamento = 'pago' THEN
    PERFORM registrar_evento_contrato(
      NEW.contrato_id, 'pagamento_registrado',
      'Pagamento #' || NEW.numero || ' confirmado · R$ ' || COALESCE(NEW.valor_pago, NEW.valor_total),
      jsonb_build_object(
        'parcela_id', NEW.id, 'numero', NEW.numero,
        'data_pagamento', NEW.data_pagamento,
        'valor_pago', NEW.valor_pago, 'juros', NEW.juros_multa, 'desconto', NEW.desconto
      )
    );
  ELSIF OLD.status_pagamento = 'pago' AND NEW.status_pagamento <> 'pago' THEN
    PERFORM registrar_evento_contrato(
      NEW.contrato_id, 'pagamento_desfeito',
      'Pagamento #' || NEW.numero || ' desfeito',
      jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
    );
  END IF;

  -- Repasse
  IF OLD.status_repasse <> NEW.status_repasse THEN
    IF NEW.status_repasse = 'pago' THEN
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'repasse_pago',
        'Repasse #' || NEW.numero || ' marcado como pago · R$ ' || NEW.valor_repasse_proprietario,
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero, 'valor', NEW.valor_repasse_proprietario)
      );
    ELSE
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'repasse_desfeito',
        'Repasse #' || NEW.numero || ' desfeito',
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
      );
    END IF;
  END IF;

  -- Seguro
  IF OLD.status_seguro <> NEW.status_seguro AND NEW.status_seguro <> 'sem_seguro' THEN
    IF NEW.status_seguro = 'pago' THEN
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'seguro_pago',
        'Seguro #' || NEW.numero || ' marcado como pago',
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
      );
    ELSE
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'seguro_desfeito',
        'Seguro #' || NEW.numero || ' desfeito',
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
      );
    END IF;
  END IF;

  -- Boleto
  IF COALESCE(OLD.boleto_enviado, FALSE) <> COALESCE(NEW.boleto_enviado, FALSE) THEN
    IF COALESCE(NEW.boleto_enviado, FALSE) THEN
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'boleto_enviado',
        'Boleto #' || NEW.numero || ' marcado como enviado',
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
      );
    ELSE
      PERFORM registrar_evento_contrato(
        NEW.contrato_id, 'boleto_desfeito',
        'Boleto #' || NEW.numero || ' desmarcado',
        jsonb_build_object('parcela_id', NEW.id, 'numero', NEW.numero)
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_parcela_upd ON parcelas_aluguel;
CREATE TRIGGER trg_log_parcela_upd
  AFTER UPDATE ON parcelas_aluguel
  FOR EACH ROW EXECUTE FUNCTION trg_log_parcela();

NOTIFY pgrst, 'reload schema';
