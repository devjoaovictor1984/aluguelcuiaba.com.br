-- ════════════════════════════════════════════════════════════════════
--  CRM v56 — Forma de recebimento da comissão no contrato de administração
--
--  'mensal'          → taxa de administração descontada/recebida mês a mês
--  'pagamento_unico' → comissão de intermediação + taxa do período recebidas
--                      de uma vez (à vista), dispensando o desconto mensal.
--
--  A cláusula de remuneração ganha o placeholder {{ADM_REMUNERACAO_FORMA}},
--  que renderiza o parágrafo correspondente conforme a escolha.
--  100% aditivo: contratos existentes ficam com 'mensal'.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_administracao
  ADD COLUMN IF NOT EXISTS recebimento_comissao TEXT NOT NULL DEFAULT 'mensal'
    CHECK (recebimento_comissao IN ('mensal', 'pagamento_unico'));

COMMENT ON COLUMN contratos_administracao.recebimento_comissao IS
  'Forma de recebimento da remuneração da administradora: mensal ou pagamento_unico (à vista).';

-- Insere o placeholder na cláusula de remuneração já existente do usuário,
-- de forma idempotente (não duplica se já estiver presente).
UPDATE contrato_clausulas
   SET corpo = corpo || E'\n\n{{ADM_REMUNERACAO_FORMA}}'
 WHERE tipo = 'administracao'
   AND categoria = 'remuneracao'
   AND corpo NOT LIKE '%ADM_REMUNERACAO_FORMA%';

NOTIFY pgrst, 'reload schema';
