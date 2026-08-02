-- ════════════════════════════════════════════════════════════════════
--  CRM v78 — Parcelas de contrato encerrado deixam de ser cobradas
--
--  Encerrar ou rescindir um contrato mudava só o status DELE. As parcelas
--  futuras continuavam 'pendente' e seguiam aparecendo em cobranças,
--  financeiro, comissões, início e relatórios — e, pior, o cron de avisos
--  de vencimento seguia mandando lembrete ao ex-inquilino.
--
--  Na renovação o efeito era duplo: as parcelas futuras do contrato antigo
--  conviviam com as do novo, cobrando duas vezes o mesmo mês.
--
--  A verdade do domínio: rescindido em D, as parcelas com vencimento
--  DEPOIS de D não são mais devidas. As de até D continuam sendo — e
--  podem estar em aberto, então não podem sumir.
--
--  Por isso 'cancelada' em vez de apagar: preserva o histórico, mantém a
--  numeração do contrato coerente e deixa auditável o que foi baixado e
--  quando. Parcela já PAGA nunca é tocada — se foi paga, aconteceu.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE parcelas_aluguel
  DROP CONSTRAINT IF EXISTS parcelas_aluguel_status_pagamento_check;

ALTER TABLE parcelas_aluguel
  ADD CONSTRAINT parcelas_aluguel_status_pagamento_check
  CHECK (status_pagamento IN (
    'pendente', 'pago', 'atrasado', 'isento', 'renegociado', 'cancelada'
  ));

ALTER TABLE parcelas_aluguel
  ADD COLUMN IF NOT EXISTS cancelada_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelada_motivo TEXT;

COMMENT ON COLUMN parcelas_aluguel.status_pagamento IS
  'pendente | pago | atrasado | isento | renegociado | cancelada. "cancelada" = contrato encerrado antes do vencimento; não é cobrança em aberto.';
COMMENT ON COLUMN parcelas_aluguel.cancelada_em IS
  'Quando a parcela deixou de ser devida. Preenchido ao encerrar/rescindir o contrato.';


-- ── Backfill ──────────────────────────────────────────────────────────
-- Corrige o passivo: todo contrato já encerrado ou rescindido cujas
-- parcelas futuras continuaram em aberto.
--
-- Corte = data_encerramento, com data_termino como reserva. Contrato sem
-- nenhuma das duas fica de fora — sem data não há como saber o que é
-- "futuro", e chutar aqui apagaria cobrança legítima.
UPDATE parcelas_aluguel p
SET status_pagamento = 'cancelada',
    cancelada_em     = NOW(),
    cancelada_motivo = 'Contrato ' || c.status || ' em ' || COALESCE(c.data_encerramento, c.data_termino)::text,
    updated_at       = NOW()
FROM contratos_locacao c
WHERE p.contrato_id = c.id
  AND c.status IN ('encerrado', 'rescindido')
  AND c.deleted_at IS NULL
  AND COALESCE(c.data_encerramento, c.data_termino) IS NOT NULL
  AND p.vencimento > COALESCE(c.data_encerramento, c.data_termino)
  -- Parcela paga fica como está: se foi paga, aconteceu.
  AND p.status_pagamento NOT IN ('pago', 'cancelada');


-- Consultas de cobrança filtram por status_pagamento e data; o índice
-- composto evita varrer parcela cancelada em toda listagem.
CREATE INDEX IF NOT EXISTS idx_parcelas_cobranca
  ON parcelas_aluguel (vencimento)
  WHERE status_pagamento NOT IN ('pago', 'cancelada');

NOTIFY pgrst, 'reload schema';
