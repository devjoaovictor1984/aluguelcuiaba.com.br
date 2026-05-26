-- ════════════════════════════════════════════════════════════════════
--  CRM v34 — Cônjuge completo + dados jurídicos do imóvel
--
--  CÔNJUGE — fica embutido na pessoa do locatário titular (caso anuente).
--  Quando o cônjuge é co-locatário solidário, ainda é melhor cadastrá-lo
--  como pessoa separada e vincular via contratos_moradores (papel=
--  inquilino_solidario). Mas pros casos comuns de anuência, ter os
--  dados completos aqui evita ter que duplicar cadastro.
--
--  IMÓVEL — campos jurídicos finos: cartório de registro, livro/folha,
--  números de hidrômetro e medidor de energia com leituras iniciais.
--  Tudo opcional.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS conjuge_naturalidade        TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_nome_pai            TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_nome_mae            TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_numero     TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_bairro     TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_cidade     TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_estado     TEXT,
  ADD COLUMN IF NOT EXISTS conjuge_endereco_cep        TEXT;

COMMENT ON COLUMN pessoas.conjuge_naturalidade IS
  'Naturalidade (cidade-UF) do cônjuge — pra qualificação completa em contrato.';
COMMENT ON COLUMN pessoas.conjuge_endereco_logradouro IS
  'Endereço do cônjuge. NULL = mesmo do titular (caso comum, casados moram juntos).';

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS cartorio_registro              TEXT,
  ADD COLUMN IF NOT EXISTS livro_folha_matricula          TEXT,
  ADD COLUMN IF NOT EXISTS hidrometro_numero              TEXT,
  ADD COLUMN IF NOT EXISTS hidrometro_leitura_inicial     TEXT,
  ADD COLUMN IF NOT EXISTS medidor_energia_numero         TEXT,
  ADD COLUMN IF NOT EXISTS medidor_energia_leitura_inicial TEXT;

COMMENT ON COLUMN imoveis.cartorio_registro IS
  'Cartório de Registro de Imóveis (ex: "1º Ofício de Registro de Imóveis de Cuiabá").';
COMMENT ON COLUMN imoveis.livro_folha_matricula IS
  'Livro/folha da matrícula (ex: "Livro 2, folha 123") — pra contratos com peso de registro.';
COMMENT ON COLUMN imoveis.hidrometro_numero IS
  'Número do hidrômetro pra controle de consumo.';
COMMENT ON COLUMN imoveis.hidrometro_leitura_inicial IS
  'Leitura inicial do hidrômetro no início da locação (texto livre, aceita formato da concessionária).';
COMMENT ON COLUMN imoveis.medidor_energia_numero IS
  'Número do medidor de energia.';
COMMENT ON COLUMN imoveis.medidor_energia_leitura_inicial IS
  'Leitura inicial do medidor de energia no início da locação.';

NOTIFY pgrst, 'reload schema';
