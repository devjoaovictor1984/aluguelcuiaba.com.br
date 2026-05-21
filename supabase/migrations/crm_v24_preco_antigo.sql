-- ════════════════════════════════════════════════════════════════════
--  CRM v24 — Preço antigo (promoção "abaixou")
--
--  Quando o anunciante baixa o aluguel, preenche preco_antigo com o
--  valor anterior. Se preco_antigo > preco, o card renderiza riscado
--  com badge "BAIXOU". NULL = sem promoção.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS preco_antigo NUMERIC(12,2);

COMMENT ON COLUMN imoveis.preco_antigo IS
  'Valor anterior do aluguel. NULL = sem promoção. Renderiza riscado quando > preco.';

NOTIFY pgrst, 'reload schema';
