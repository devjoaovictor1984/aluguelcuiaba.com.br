-- ════════════════════════════════════════════════════════════════════
--  CRM v28 — Dados reais do imóvel pro contrato
--
--  O cadastro do imóvel hoje guarda os dados de anúncio (título,
--  descrição curta, endereço resumido). Pro contrato, precisamos do
--  endereço completo, matrículas (cartório, IPTU), UC de energia,
--  matrícula de água, áreas exatas e descrição jurídica.
--
--  Todos opcionais: vazio = puxa do anúncio na hora de gerar contrato.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS endereco_completo     TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero       TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento  TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep          TEXT,
  ADD COLUMN IF NOT EXISTS matricula_cartorio    TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal   TEXT,
  ADD COLUMN IF NOT EXISTS uc_energia            TEXT,
  ADD COLUMN IF NOT EXISTS matricula_agua        TEXT,
  ADD COLUMN IF NOT EXISTS area_construida_m2    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS area_terreno_m2       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS descricao_real        TEXT;

COMMENT ON COLUMN imoveis.endereco_completo IS
  'Logradouro completo pro contrato (sem abreviação). NULL = usa endereco_resumido do anúncio.';
COMMENT ON COLUMN imoveis.endereco_numero IS
  'Número do imóvel.';
COMMENT ON COLUMN imoveis.endereco_complemento IS
  'Apto, bloco, casa, etc.';
COMMENT ON COLUMN imoveis.endereco_cep IS
  'CEP, só números.';
COMMENT ON COLUMN imoveis.matricula_cartorio IS
  'Número da matrícula do imóvel no Cartório de Registro de Imóveis.';
COMMENT ON COLUMN imoveis.inscricao_municipal IS
  'Inscrição municipal/IPTU do imóvel.';
COMMENT ON COLUMN imoveis.uc_energia IS
  'Unidade Consumidora da concessionária de energia (ex: CEMAT/Energisa).';
COMMENT ON COLUMN imoveis.matricula_agua IS
  'Matrícula do hidrômetro/SANECAP.';
COMMENT ON COLUMN imoveis.area_construida_m2 IS
  'Área construída exata pro contrato (pode diferir da area_m2 do anúncio).';
COMMENT ON COLUMN imoveis.area_terreno_m2 IS
  'Área do terreno.';
COMMENT ON COLUMN imoveis.descricao_real IS
  'Descrição detalhada/jurídica pro contrato. NULL = usa descricao do anúncio.';

NOTIFY pgrst, 'reload schema';
