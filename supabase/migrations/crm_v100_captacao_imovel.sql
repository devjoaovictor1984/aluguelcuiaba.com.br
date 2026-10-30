-- ════════════════════════════════════════════════════════════════════
--  CRM v100 — Captação: o link de cadastro também pede o imóvel
--
--  Até aqui o link /atualizar-cadastro só preenchia a PESSOA. Na
--  captação, quem tem os números do imóvel (matrícula, UC de energia,
--  água, gás, IPTU, condomínio) é a proprietária, e ela mandava isso
--  por WhatsApp pra alguém redigitar.
--
--  O link passa a ter um bloco de imóvel:
--    • imovel_id     → se o imóvel já existe, o que ela preencher vai
--                      direto pras colunas de `imoveis`;
--    • campos_imovel → quais campos do imóvel o link pede;
--    • dados_imovel  → tudo o que ela mandou, sempre. Quando o imóvel
--                      ainda não existe, é daqui que sai o anúncio novo
--                      ("Criar anúncio com estes dados").
--
--  Os documentos do imóvel (matrícula, contas, carnê do IPTU…) entram em
--  `pessoas_documentos` da proprietária, com tipos novos. Assim aparecem
--  sozinhos na lista de anexos do contrato de administração, que já lê
--  os documentos das partes.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS uc_gas TEXT;

COMMENT ON COLUMN imoveis.uc_gas IS
  'Código do cliente/medidor de gás encanado (concessionária ou do condomínio).';

ALTER TABLE solicitacoes_cadastro
  ADD COLUMN IF NOT EXISTS imovel_id     UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campos_imovel JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dados_imovel  JSONB;

COMMENT ON COLUMN solicitacoes_cadastro.imovel_id IS
  'Imóvel que recebe os dados do bloco de imóvel. NULL = imóvel ainda não cadastrado (captação).';
COMMENT ON COLUMN solicitacoes_cadastro.campos_imovel IS
  'Campos do imóvel que o link pede (chaves imovel_*).';
COMMENT ON COLUMN solicitacoes_cadastro.dados_imovel IS
  'O que a pessoa preencheu no bloco de imóvel, chave → texto. Fica guardado mesmo depois de aplicado.';

-- Tipos de documento do imóvel
ALTER TABLE pessoas_documentos
  DROP CONSTRAINT IF EXISTS pessoas_documentos_tipo_check;

ALTER TABLE pessoas_documentos
  ADD CONSTRAINT pessoas_documentos_tipo_check
  CHECK (tipo IN (
    'rg','cpf','cnh','passaporte',
    'comprovante_renda','comprovante_residencia',
    'contracheque','extrato_bancario','imposto_renda',
    'certidao_casamento','certidao_nascimento',
    'foto','outro',
    -- imóvel
    'matricula_imovel','escritura','iptu',
    'conta_energia','conta_agua','conta_gas',
    'boleto_condominio','procuracao'
  ));

NOTIFY pgrst, 'reload schema';
