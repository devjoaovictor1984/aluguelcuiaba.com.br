-- ════════════════════════════════════════════════════════════════════
--  CRM v29 — Campos contratuais em pessoas
--
--  O cadastro de pessoa hoje cobre o básico (nome, CPF, RG, endereço).
--  Pra gerar contrato com peso jurídico (igual o modelo IMOBILIATTO),
--  precisamos de: naturalidade, filiação (pai/mãe), órgão emissor do
--  RG, regime de bens (quando casado), renda mensal pra análise de
--  crédito, e os dados completos do cônjuge.
--
--  Tudo opcional — quem não preencher segue funcionando como hoje.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS naturalidade           TEXT,
  ADD COLUMN IF NOT EXISTS nome_pai               TEXT,
  ADD COLUMN IF NOT EXISTS nome_mae               TEXT,
  ADD COLUMN IF NOT EXISTS rg_orgao_emissor       TEXT,
  ADD COLUMN IF NOT EXISTS rg_uf                  TEXT,
  ADD COLUMN IF NOT EXISTS regime_bens            TEXT,
  ADD COLUMN IF NOT EXISTS renda_mensal           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS conjuge_nome           TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_cpf            TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_rg             TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_rg_orgao       TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS conjuge_profissao      TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_nacionalidade  TEXT;

COMMENT ON COLUMN pessoas.naturalidade IS
  'Cidade-UF de nascimento (ex: Várzea Grande-MT). Usado em contrato: "natural de X".';
COMMENT ON COLUMN pessoas.nome_pai IS
  'Nome do pai. Aparece em contratos como filiação.';
COMMENT ON COLUMN pessoas.nome_mae IS
  'Nome da mãe. Aparece em contratos como filiação.';
COMMENT ON COLUMN pessoas.rg_orgao_emissor IS
  'Órgão emissor do RG (ex: SSP, SESP). Combinado com rg_uf vira "SSP/MT".';
COMMENT ON COLUMN pessoas.rg_uf IS
  'UF de emissão do RG (ex: MT, SP).';
COMMENT ON COLUMN pessoas.regime_bens IS
  'Regime de bens do casamento (ex: comunhão parcial, comunhão universal, separação total). NULL pra solteiros.';
COMMENT ON COLUMN pessoas.renda_mensal IS
  'Renda mensal declarada. Usada em análise de crédito; não aparece automaticamente em contrato.';
COMMENT ON COLUMN pessoas.conjuge_nome IS
  'Nome completo do cônjuge. Preenchido quando estado_civil é casado/união estável.';

NOTIFY pgrst, 'reload schema';
