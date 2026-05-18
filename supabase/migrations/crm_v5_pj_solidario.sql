-- ════════════════════════════════════════════════════════════════════
--  CRM v5 — Inquilino pessoa jurídica + Aluguel solidário
--  Permite cadastrar empresas como inquilinos (com sócios signatários)
--  e múltiplos co-inquilinos solidários no mesmo contrato.
-- ════════════════════════════════════════════════════════════════════

-- 1. Pessoas: campos extras para PJ (opcionais)
ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS nome_fantasia       TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual  TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;
-- Detecção de PF/PJ é feita pelo tamanho do cpf_cnpj (11 = CPF, 14 = CNPJ).

-- 2. contratos_moradores: papel + mora_no_imovel
ALTER TABLE contratos_moradores
  ADD COLUMN IF NOT EXISTS papel TEXT NOT NULL DEFAULT 'morador',
  ADD COLUMN IF NOT EXISTS mora_no_imovel BOOLEAN NOT NULL DEFAULT TRUE;

-- Atualiza check pra incluir os novos papéis (drop + add porque ADD CONSTRAINT IF NOT EXISTS não suportado em <=Postgres 15)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contratos_moradores_papel_check'
  ) THEN
    ALTER TABLE contratos_moradores DROP CONSTRAINT contratos_moradores_papel_check;
  END IF;
END$$;

ALTER TABLE contratos_moradores
  ADD CONSTRAINT contratos_moradores_papel_check
  CHECK (papel IN ('morador', 'inquilino_solidario', 'socio_signatario'));

-- 3. parentesco pode ser null (sócio/co-inquilino nem sempre tem relação familiar)
ALTER TABLE contratos_moradores
  ALTER COLUMN parentesco DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
