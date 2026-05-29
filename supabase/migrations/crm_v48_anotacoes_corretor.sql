-- ════════════════════════════════════════════════════════════════════
--  CRM v48 — Anotações internas do corretor no contrato
--
--  Campo livre pra o corretor registrar particularidades da negociação
--  (lembretes pra renovação, combinados verbais, pontos de atenção).
--  É INTERNO — não aparece no PDF do contrato.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS anotacoes_corretor TEXT;

COMMENT ON COLUMN contratos_locacao.anotacoes_corretor IS
  'Anotações internas do corretor sobre a negociação — não vão no PDF.';

NOTIFY pgrst, 'reload schema';
