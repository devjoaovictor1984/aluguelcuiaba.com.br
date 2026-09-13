-- ─────────────────────────────────────────────────────────────────────
-- v88 · Garantias aceitas no anúncio
--
-- POR QUE: a garantia é a primeira pergunta de quem procura aluguel, e
-- hoje só aparece depois, no contrato. Quem não tem fiador some da
-- conversa antes de ligar; quem tem dinheiro pra caução não sabe que
-- aquele imóvel aceita. Passa a ser informação do anúncio.
--
-- O valor do seguro fiança é APROXIMADO e digitado pelo anunciante: a
-- cotação real depende da análise do inquilino. O teto de 13% do aluguel
-- é validado na tela, não aqui — é regra de negócio, muda com o mercado,
-- e um CHECK no banco travaria o cadastro numa migration.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS garantia_fianca              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS garantia_fianca_valor        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS garantia_caucao              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS garantia_caucao_meses        SMALLINT,
  ADD COLUMN IF NOT EXISTS garantia_fiador              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seguro_incendio_obrigatorio  BOOLEAN NOT NULL DEFAULT FALSE;

-- 1, 2 ou 3 aluguéis. NULL quando caução não é aceita.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imoveis_caucao_meses_ck'
  ) THEN
    ALTER TABLE imoveis
      ADD CONSTRAINT imoveis_caucao_meses_ck
      CHECK (garantia_caucao_meses IS NULL OR garantia_caucao_meses BETWEEN 1 AND 3);
  END IF;
END $$;

COMMENT ON COLUMN imoveis.garantia_fianca IS
  'Aceita seguro fiança como garantia da locação.';
COMMENT ON COLUMN imoveis.garantia_fianca_valor IS
  'Valor MENSAL aproximado do seguro fiança, digitado pelo anunciante. Estimativa: a cotação real depende da análise do inquilino. Teto de 13% do aluguel validado na tela.';
COMMENT ON COLUMN imoveis.garantia_caucao IS
  'Aceita caução (depósito) como garantia.';
COMMENT ON COLUMN imoveis.garantia_caucao_meses IS
  'Quantos aluguéis de caução: 1, 2 ou 3. NULL quando não aceita caução.';
COMMENT ON COLUMN imoveis.garantia_fiador IS
  'Aceita fiador como garantia.';
COMMENT ON COLUMN imoveis.seguro_incendio_obrigatorio IS
  'O seguro incêndio é exigido na locação deste imóvel. Custo à parte, não entra no aluguel.';

NOTIFY pgrst, 'reload schema';
