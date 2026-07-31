-- ════════════════════════════════════════════════════════════════════
--  CRM v73 — Módulo de seguros (parceria Maximiza)
--
--  A Maximiza é CORRETORA, não seguradora: uma única integração cota em
--  paralelo com Too, Tokio, Pottencial e Porto. Por isso o modelo é
--  1 análise → N pareceres, um por seguradora, cada um com status,
--  código e documentos próprios.
--
--  Fluxo da API (fiança):
--    1. o corretor precisa existir lá como "imobiliária" (CPF/CNPJ dele)
--       → seguro_imobiliarias
--    2. transmitirAnalise           → seguro_analises + pareceres
--    3. webhooks analise/biometria/arquivos atualizam os pareceres
--    4. consultarPrecosApi          → planos e formas de pagamento
--    5. contratar                   → seguro_contratacoes
--       (o retorno NÃO traz número de apólice; ela chega depois pelo
--        webhook de arquivos com codigo_tipo = 9)
--
--  Decisões:
--
--  · CREDENCIAL NÃO FICA NO BANCO. É e-mail/senha da plataforma, em env
--    var, usada server-side. O usuário final nunca vê nem toca.
--
--  · `produto` já existe com default 'fianca'. A spec do seguro incêndio
--    ainda não chegou; se o fluxo dele couber aqui, reusa — se não,
--    ganha tabelas próprias sem quebrar estas.
--
--  · `ambiente` (1=produção, 2=homologação) é gravado em cada análise.
--    A API usa a MESMA URL pros dois — sem isso não há como saber depois
--    se um registro é teste ou apólice real.
--
--  · Documentos (carta parecer, apólice) vão pro bucket PRIVADO
--    'seguros-docs', igual às selfies (v53): guardamos o CAMINHO e
--    assinamos URL sob demanda. São dados pessoais do inquilino.
--
--  · seguro_eventos loga TODA chamada e TODO webhook. É a trilha que
--    prova a originação numa eventual divergência de comissão.
-- ════════════════════════════════════════════════════════════════════


-- ── 1. Vínculo do usuário com a corretora ─────────────────────────────
-- Cada corretor/imobiliária precisa estar cadastrado do lado da Maximiza
-- (imobiliaria.cnpj é obrigatório quando ambiente = 1). cod_alfa/cod_porto
-- vêm no retorno da consulta e são os códigos por seguradora.
CREATE TABLE IF NOT EXISTS seguro_imobiliarias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  cnpj_cpf          TEXT NOT NULL,              -- chave de consulta na API
  maximiza_id       BIGINT,                     -- id retornado no cadastro
  cod_alfa          BIGINT,
  cod_porto         BIGINT,

  razao             TEXT,
  fantasia          TEXT,
  responsavel_nome  TEXT,
  responsavel_cpf   TEXT,

  dados             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- retorno cru da consulta
  sincronizado_em   TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE seguro_imobiliarias IS
  'Vínculo 1:1 entre o usuário do CRM e o cadastro de imobiliária na Maximiza.';
COMMENT ON COLUMN seguro_imobiliarias.cod_alfa IS
  'Código da imobiliária numa das seguradoras (vem no consultarImobiliaria). Uso a confirmar com a Maximiza.';


-- ── 2. Análise ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguro_analises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto           TEXT NOT NULL DEFAULT 'fianca' CHECK (produto IN ('fianca','incendio')),

  -- Origem no CRM. Tudo opcional: dá pra cotar antes de existir contrato.
  contrato_id       UUID REFERENCES contratos_locacao(id) ON DELETE SET NULL,
  imovel_id         UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  inquilino_id      UUID REFERENCES pessoas(id) ON DELETE SET NULL,

  maximiza_id       BIGINT,                     -- id da análise na corretora
  ambiente          SMALLINT NOT NULL CHECK (ambiente IN (1,2)),
  tipo_analise      TEXT NOT NULL DEFAULT 'reduzida' CHECK (tipo_analise IN ('reduzida','completa')),
  finalidade        TEXT NOT NULL DEFAULT 'R' CHECK (finalidade IN ('R','C')),

  -- Snapshot do que foi enviado. O CRM muda; a análise não pode mudar junto.
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  valor_aluguel     NUMERIC(12,2),

  -- Consentimento LGPD: enviamos CPF/renda do inquilino a terceiro.
  consentimento_em  TIMESTAMPTZ,
  consentimento_ip  TEXT,

  -- Derivado do melhor parecer, só pra listar/filtrar sem join.
  status_resumo     TEXT NOT NULL DEFAULT 'enviando',
  erro              TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (produto, ambiente, maximiza_id)
);

CREATE INDEX IF NOT EXISTS seguro_analises_user_idx
  ON seguro_analises (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seguro_analises_contrato_idx
  ON seguro_analises (contrato_id) WHERE contrato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS seguro_analises_maximiza_idx
  ON seguro_analises (maximiza_id) WHERE maximiza_id IS NOT NULL;

COMMENT ON COLUMN seguro_analises.ambiente IS
  '1=Produção, 2=Homologação. A API usa a mesma URL nos dois — sem isto não dá pra distinguir teste de apólice real.';
COMMENT ON COLUMN seguro_analises.payload IS
  'Snapshot do JSON enviado. Auditoria: o cadastro no CRM muda depois, a análise não.';


-- ── 3. Parecer por seguradora ─────────────────────────────────────────
-- Uma análise vai pra N seguradoras e cada uma responde independente:
-- Porto aprova, Tokio recusa, Too fica em análise — tudo ao mesmo tempo.
CREATE TABLE IF NOT EXISTS seguro_analise_pareceres (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id        UUID NOT NULL REFERENCES seguro_analises(id) ON DELETE CASCADE,

  seguradora_sigla  TEXT NOT NULL,              -- 'too','tok','ptc','porto'
  seguradora_nome   TEXT,

  -- Ver tabela TIPO CODIGO STATUS da doc (0..12). Guardamos o CÓDIGO:
  -- o descricaoStatus da API é inconsistente entre páginas do PDF.
  codigo_status     SMALLINT,
  descricao_status  TEXT,
  codigo_analise    TEXT,                       -- id na seguradora (chega como número grande)
  limite_aprovado   NUMERIC(12,2),
  msg               TEXT,

  -- Eixo INDEPENDENTE do status da análise: pode estar pré-aprovado (12)
  -- com biometria aguardando (0) ou recusada (3).
  status_biometria  SMALLINT,
  link_biometria    TEXT,

  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (analise_id, seguradora_sigla)
);

CREATE INDEX IF NOT EXISTS seguro_pareceres_analise_idx
  ON seguro_analise_pareceres (analise_id);

COMMENT ON COLUMN seguro_analise_pareceres.codigo_status IS
  '0 erro · 1 aprovado · 2 em análise · 3 recusado · 4 pendente · 5 aprovado c/ limite inferior · 6 cancelado · 7 expirada · 8 aguardando emissão · 12 pré-aprovado';
COMMENT ON COLUMN seguro_analise_pareceres.status_biometria IS
  '0 aguardando · 1 aprovado · 2 cancelado · 3 recusado. Independente de codigo_status.';


-- ── 4. Documentos ─────────────────────────────────────────────────────
-- Chegam em base64 pelo webhook /arquivos ou no GET da análise.
-- O binário vai pro bucket privado; aqui fica só o metadado.
CREATE TABLE IF NOT EXISTS seguro_arquivos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id        UUID NOT NULL REFERENCES seguro_analises(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  seguradora_sigla  TEXT,
  codigo_tipo       SMALLINT NOT NULL,          -- 1 ficha · 2 carta parecer · 3 cotação · 4 contrato · 5 vistoria · 8 proposta · 9 APÓLICE
  descricao         TEXT,

  storage_path      TEXT NOT NULL,              -- caminho no bucket privado
  tamanho_bytes     INTEGER,

  recebido_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (analise_id, seguradora_sigla, codigo_tipo)
);

CREATE INDEX IF NOT EXISTS seguro_arquivos_analise_idx
  ON seguro_arquivos (analise_id);

COMMENT ON COLUMN seguro_arquivos.storage_path IS
  'Caminho no bucket privado seguros-docs. Nunca URL pública: contém dado pessoal do inquilino.';


-- ── 5. Contratação ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguro_contratacoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id            UUID NOT NULL REFERENCES seguro_analises(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seguradora_sigla      TEXT NOT NULL,

  -- Plano e pagamento (vêm do consultarPrecosApi)
  tipo_plano            TEXT,                   -- basic / complete / traditional
  forma_pagto           TEXT,                   -- Fatura, Boleto, Cartão de Crédito...
  qtd_parcelas          INTEGER,
  valor_parcela         NUMERIC(12,2),
  premio_total          NUMERIC(12,2),
  entrada_pagto         SMALLINT,               -- 0 sem entrada, 1 com

  inicio_vigencia       DATE,
  fim_vigencia          DATE,
  indice_reajuste       SMALLINT,               -- código 1..10 da tabela deles

  -- Coberturas/encargos cobertos: {condominio, gas, iptu, energia, agua,
  -- danos, pintura_int, pintura_ext, multa}
  coberturas            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Snapshot do proprietário no momento da contratação.
  proprietario          JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- O /contratar responde só com uma msg. O número da apólice chega
  -- depois, pelo webhook de arquivos (codigo_tipo = 9).
  status                TEXT NOT NULL DEFAULT 'enviada'
                          CHECK (status IN ('enviada','emitida','recusada','cancelada','erro')),
  apolice_numero        TEXT,
  emitida_em            TIMESTAMPTZ,

  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  retorno_msg           TEXT,
  erro                  TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seguro_contratacoes_user_idx
  ON seguro_contratacoes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seguro_contratacoes_analise_idx
  ON seguro_contratacoes (analise_id);

COMMENT ON TABLE seguro_contratacoes IS
  'Uma contratação por análise+seguradora escolhida. Nunca guardar dados de cartão aqui (PCI-DSS).';


-- ── 6. Log de integração ──────────────────────────────────────────────
-- Toda chamada nossa e todo webhook recebido. Serve pra depurar e, mais
-- importante, pra provar a originação numa divergência de comissão.
CREATE TABLE IF NOT EXISTS seguro_eventos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- null em webhook
  analise_id    UUID REFERENCES seguro_analises(id) ON DELETE SET NULL,

  direcao       TEXT NOT NULL CHECK (direcao IN ('saida','entrada')),
  endpoint      TEXT NOT NULL,
  http_status   SMALLINT,
  duracao_ms    INTEGER,

  request       JSONB,                          -- sanitizado (sem cartão/senha)
  response      JSONB,                          -- sanitizado (sem base64)
  erro          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seguro_eventos_analise_idx
  ON seguro_eventos (analise_id, created_at DESC) WHERE analise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS seguro_eventos_data_idx
  ON seguro_eventos (created_at DESC);

COMMENT ON TABLE seguro_eventos IS
  'Trilha de auditoria da integração. Request/response passam por sanitização antes de gravar: nunca cartão, senha ou base64 de documento.';


-- ── RLS ───────────────────────────────────────────────────────────────
-- Mesmo padrão do resto do CRM: o dono enxerga o que é dele. Webhooks e
-- chamadas à API usam service-role (admin client), que ignora RLS.
ALTER TABLE seguro_imobiliarias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_analises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_analise_pareceres ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_arquivos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_contratacoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_eventos           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seguro_imob_dono ON seguro_imobiliarias;
CREATE POLICY seguro_imob_dono ON seguro_imobiliarias
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS seguro_analises_dono ON seguro_analises;
CREATE POLICY seguro_analises_dono ON seguro_analises
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Pareceres não têm user_id: herdam a posse da análise.
DROP POLICY IF EXISTS seguro_pareceres_dono ON seguro_analise_pareceres;
CREATE POLICY seguro_pareceres_dono ON seguro_analise_pareceres
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM seguro_analises a
                 WHERE a.id = seguro_analise_pareceres.analise_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM seguro_analises a
                      WHERE a.id = seguro_analise_pareceres.analise_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS seguro_arquivos_dono ON seguro_arquivos;
CREATE POLICY seguro_arquivos_dono ON seguro_arquivos
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS seguro_contratacoes_dono ON seguro_contratacoes;
CREATE POLICY seguro_contratacoes_dono ON seguro_contratacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Log: leitura apenas, e só do que é do próprio usuário. Escrita é
-- exclusiva do service-role — o cliente não forja trilha de auditoria.
DROP POLICY IF EXISTS seguro_eventos_leitura_dono ON seguro_eventos;
CREATE POLICY seguro_eventos_leitura_dono ON seguro_eventos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ── Bucket privado dos documentos ─────────────────────────────────────
-- Carta parecer, cotação e apólice trazem dados do inquilino. Mesmo
-- tratamento das selfies (v53): sem leitura pública, URL assinada na hora.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-docs',
  'seguros-docs',
  false,                                   -- PRIVADO
  10485760,                                -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS seguros_docs_select_publico ON storage.objects;


-- ── updated_at ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seguros_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seguro_imob_touch ON seguro_imobiliarias;
CREATE TRIGGER trg_seguro_imob_touch BEFORE UPDATE ON seguro_imobiliarias
  FOR EACH ROW EXECUTE FUNCTION seguros_touch_updated_at();

DROP TRIGGER IF EXISTS trg_seguro_analises_touch ON seguro_analises;
CREATE TRIGGER trg_seguro_analises_touch BEFORE UPDATE ON seguro_analises
  FOR EACH ROW EXECUTE FUNCTION seguros_touch_updated_at();

DROP TRIGGER IF EXISTS trg_seguro_contratacoes_touch ON seguro_contratacoes;
CREATE TRIGGER trg_seguro_contratacoes_touch BEFORE UPDATE ON seguro_contratacoes
  FOR EACH ROW EXECUTE FUNCTION seguros_touch_updated_at();

NOTIFY pgrst, 'reload schema';
