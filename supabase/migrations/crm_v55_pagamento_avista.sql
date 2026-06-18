-- ════════════════════════════════════════════════════════════════════
--  CRM v55 — Pagamento à vista (período adiantado)
--
--  Permite registrar contratos em que o inquilino paga o período inteiro
--  de uma vez. As parcelas continuam sendo geradas mês a mês (pro repasse
--  ao proprietário seguir por competência), porém já entram QUITADAS.
--  Um recibo único consolidado é emitido pelo valor total.
--
--  100% aditivo: contratos existentes ficam com pagamento_antecipado = FALSE
--  e não sofrem nenhuma alteração.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS pagamento_antecipado      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_pagamento_antecipado DATE,
  ADD COLUMN IF NOT EXISTS recibo_avista_numero      SMALLINT;

COMMENT ON COLUMN contratos_locacao.pagamento_antecipado IS
  'TRUE quando o inquilino pagou o período inteiro à vista. Parcelas são geradas já quitadas; repasse ao proprietário segue mensal.';
COMMENT ON COLUMN contratos_locacao.data_pagamento_antecipado IS
  'Data em que o pagamento à vista foi recebido. Usada como data_pagamento das parcelas e no recibo consolidado.';
COMMENT ON COLUMN contratos_locacao.recibo_avista_numero IS
  'Número sequencial do recibo consolidado do pagamento à vista (gerado na 1ª emissão).';

NOTIFY pgrst, 'reload schema';
