-- ─────────────────────────────────────────────────────────────────────
-- v90 · Contrato importado (assinado fora da plataforma)
--
-- POR QUE: contrato negociado antes da plataforma existir, ou fechado no
-- papel, precisa entrar aqui pra receber reajuste e termo aditivo — que
-- é o que a plataforma sabe fazer e o Word não. Sem uma marca, daqui a
-- um ano ninguém distingue o que a plataforma gerou do que ela só
-- guardou, e alguém vai procurar no sistema um PDF que nunca existiu.
--
-- A marca não muda comportamento nenhum: reajuste, aditivo, parcelas e
-- assinatura funcionam igual. Ela existe pra ser lida por gente.
--
-- O que NÃO vira coluna: quantas parcelas gerar. Isso é decisão do
-- momento do cadastro (de qual mês em diante a cobrança passa pela
-- plataforma), não um atributo do contrato. Depois de gerado, quem
-- responde essa pergunta são as próprias parcelas.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS importado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN contratos_locacao.importado IS
  'TRUE quando o contrato foi assinado fora da plataforma e cadastrado aqui só para receber reajustes e aditivos. O instrumento original fica anexado como PDF assinado.';

NOTIFY pgrst, 'reload schema';
