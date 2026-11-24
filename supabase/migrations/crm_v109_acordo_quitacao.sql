-- ─────────────────────────────────────────────────────────────────────
-- v109 · Acordo de quitação (negociação das parcelas em aberto)
--
-- POR QUE: o locatário sai antes do fim, negocia, e paga um valor só
-- por várias parcelas (ex.: 2 × R$ 3.600 quitadas por R$ 3.600). Até
-- aqui o sistema só sabia marcar parcela como paga cheia, ou cancelar.
-- Marcar com desconto não recalculava comissão nem repasse — que o
-- financeiro lê gravados em cada parcela —, então a conta saía errada.
--
-- O acordo rateia o valor recebido entre as parcelas escolhidas
-- (proporcional ao valor de cada uma), grava o desconto, e recalcula
-- comissão e repasse sobre o que de fato entrou. Guarda os valores
-- originais de cada parcela em `parcelas` (JSONB) para DESFAZER: sem
-- isso, desfazer o pagamento deixaria a comissão reduzida para sempre.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contratos_acordos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  data_pagamento  DATE NOT NULL,
  -- Soma do valor_total das parcelas antes do acordo.
  valor_original  NUMERIC(12,2) NOT NULL CHECK (valor_original > 0),
  -- O que o locatário pagou pelo conjunto.
  valor_acordado  NUMERIC(12,2) NOT NULL CHECK (valor_acordado >= 0),
  observacao      TEXT,

  -- Foto de cada parcela antes do acordo, para desfazer:
  -- [{id, numero, valor_total, valor_comissao, valor_repasse_proprietario,
  --   status_pagamento, observacoes}]
  parcelas        JSONB NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valor_acordado <= valor_original)
);

CREATE INDEX IF NOT EXISTS idx_acordos_contrato ON contratos_acordos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_acordos_user ON contratos_acordos(user_id);

ALTER TABLE contratos_acordos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acordos_owner_all ON contratos_acordos;
CREATE POLICY acordos_owner_all ON contratos_acordos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Parcela quitada por acordo aponta para ele. Desfazer o pagamento dela
-- sozinha é bloqueado: desfaz-se o acordo inteiro, que restaura os valores.
ALTER TABLE parcelas_aluguel
  ADD COLUMN IF NOT EXISTS acordo_id UUID REFERENCES contratos_acordos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcelas_acordo ON parcelas_aluguel(acordo_id) WHERE acordo_id IS NOT NULL;

COMMENT ON TABLE contratos_acordos IS
  'Acordo de quitação: várias parcelas em aberto pagas por um valor negociado. Rateio proporcional; comissão e repasse sobre o que entrou.';
COMMENT ON COLUMN parcelas_aluguel.acordo_id IS
  'v109 — parcela quitada por acordo de quitação. Desfaz-se pelo acordo, não pela parcela.';

NOTIFY pgrst, 'reload schema';
