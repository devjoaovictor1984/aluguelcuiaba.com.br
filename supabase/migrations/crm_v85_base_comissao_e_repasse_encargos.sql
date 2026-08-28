-- v85 — Base de cálculo da comissão + IPTU/condomínio no repasse
--
-- Dois ajustes na regra financeira das parcelas:
--
-- 1) O repasse ao proprietário ignorava IPTU e condomínio. Era
--    `repasse = aluguel - comissão`, então um boleto de R$ 3.800
--    (3.500 de aluguel + 300 de IPTU) com 10% sobre o aluguel repassava
--    R$ 3.150 e os R$ 300 do IPTU sumiam. Passa a ser
--    `repasse = aluguel + IPTU + condomínio - comissão`.
--    O seguro fiança continua fora: vai pra seguradora, não pro dono.
--
-- 2) Fica explícito sobre o que a comissão incide. Tem contrato em que a
--    taxa é só sobre o aluguel e tem contrato em que o aluguel já vem com
--    os encargos embutidos e a taxa é sobre o pacote inteiro. Antes isso
--    era implícito (sempre só o aluguel).

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS taxa_admin_base TEXT NOT NULL DEFAULT 'aluguel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contratos_locacao_taxa_admin_base_check'
  ) THEN
    ALTER TABLE contratos_locacao
      ADD CONSTRAINT contratos_locacao_taxa_admin_base_check
      CHECK (taxa_admin_base IN ('aluguel', 'aluguel_encargos'));
  END IF;
END $$;

COMMENT ON COLUMN contratos_locacao.taxa_admin_base IS
  'Sobre o que a taxa de administração percentual incide: "aluguel" (só o aluguel) ou "aluguel_encargos" (aluguel + IPTU + condomínio). Ignorado quando taxa_admin_tipo = fixo. O seguro fiança nunca entra na base.';

-- ─── Backfill do repasse ───────────────────────────────────────────────
-- Corrige só as parcelas com encargos cujo repasse ainda não foi feito
-- (status_repasse = 'pendente') e que estão exatamente na fórmula antiga.
-- Parcelas já repassadas ficam como estão: são histórico, o acerto do que
-- passou é manual.
UPDATE parcelas_aluguel
SET valor_repasse_proprietario =
      ROUND(valor_aluguel + COALESCE(valor_iptu, 0) + COALESCE(valor_condominio, 0) - valor_comissao, 2)
WHERE status_repasse = 'pendente'
  AND COALESCE(valor_iptu, 0) + COALESCE(valor_condominio, 0) > 0
  AND valor_repasse_proprietario = ROUND(valor_aluguel - valor_comissao, 2);
