-- ════════════════════════════════════════════════════════════════════
--  CRM v16 — Nota Fiscal de comissão emitida
--  Marca em parcelas_aluguel quando a NF de serviço (comissão) foi
--  emitida na prefeitura. Permite filtrar/auditar o que ainda falta.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE parcelas_aluguel
  ADD COLUMN IF NOT EXISTS nf_emitida_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nf_numero      TEXT;

-- Índice parcial pra acelerar o filtro "ainda não emitida"
CREATE INDEX IF NOT EXISTS parcelas_nf_pendente_idx
  ON parcelas_aluguel (contrato_id)
  WHERE nf_emitida_em IS NULL AND status_pagamento = 'pago';

NOTIFY pgrst, 'reload schema';
