-- ════════════════════════════════════════════════════════════════════
--  CRM v77 — Seguro incêndio (Maximiza / Alfa e Porto)
--
--  Tabelas PRÓPRIAS, e não `produto = 'incendio'` nas de fiança. Os dois
--  produtos são tecnicamente diferentes:
--
--    fiança   → análise de crédito → N pareceres → aprovação → contratação
--               (assíncrono, resultado chega por webhook)
--    incêndio → cálculo → contratação
--               (síncrono, sem análise: ninguém aprova ou recusa)
--
--  Forçar os dois no mesmo schema faria `seguro_analise_pareceres` existir
--  vazio pra todo incêndio, e `status_resumo` significar coisas diferentes
--  conforme o produto.
--
--  O que É compartilhado, e continua sendo:
--    · seguro_imobiliarias — mesmo cadastro, mesmo endpoint
--    · seguro_eventos      — mesma trilha de auditoria
--    · bucket seguros-docs — mesmos documentos privados
--
--  Particularidades da API de incêndio:
--    · host próprio (incendio.api.seguro.imb.br)
--    · header extra `seguradora: Alfa|Porto` em quase toda chamada
--    · tem cancelamento e faturamento, que a fiança não tem
--    · documentos sob demanda (imprimirProposta/imprimirBoleto), não push
-- ════════════════════════════════════════════════════════════════════


-- ── Apólices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguro_incendio_apolices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Origem no CRM. Opcional: dá pra cotar antes de existir contrato.
  contrato_id           UUID REFERENCES contratos_locacao(id) ON DELETE SET NULL,
  imovel_id             UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  inquilino_id          UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  proprietario_id       UUID REFERENCES pessoas(id) ON DELETE SET NULL,

  seguradora            TEXT NOT NULL,              -- 'Alfa' | 'Porto' (vai no header)
  ambiente              SMALLINT NOT NULL CHECK (ambiente IN (1,2)),

  -- Configuração do seguro
  tipo_seguro           TEXT NOT NULL DEFAULT 'R' CHECK (tipo_seguro IN ('R','C')),
  tipo_cobertura        SMALLINT CHECK (tipo_cobertura IN (2,3,4,5)),
  tipo_vigencia         SMALLINT NOT NULL DEFAULT 0 CHECK (tipo_vigencia IN (0,1)),
  ocupacao_nome         TEXT,
  ocupacao_rubrica      TEXT,
  ocupacao_cdresp2      TEXT,
  pacote_assist         SMALLINT,
  pacote_assist_nome    TEXT,

  valor_aluguel         NUMERIC(12,2),

  -- Limites de cada cobertura enviados no cálculo.
  coberturas_valores    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Vigência
  inicio_vigencia       DATE,
  fim_vigencia          DATE,

  -- Retorno do cálculo: coberturas com prêmio e franquia, formas de
  -- pagamento, prêmio, assistência, líquido e IOF.
  calculo               JSONB,
  calculo_em            TIMESTAMPTZ,

  -- Pagamento escolhido
  forma_pagto_codigo    TEXT,
  forma_pagto_descricao TEXT,
  qtd_parcelas          SMALLINT CHECK (qtd_parcelas BETWEEN 1 AND 6),
  valor_parcela         NUMERIC(12,2),
  premio_total          NUMERIC(12,2),
  valor_iof             NUMERIC(12,2),
  valor_assistencia     NUMERIC(12,2),

  -- Identificadores da corretora/seguradora
  codigo_seguro         TEXT,                       -- chave de cancelar/imprimir
  numero_proposta       TEXT,

  status                TEXT NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho','calculada','contratada','cancelada','erro')),
  contratada_em         TIMESTAMPTZ,
  cancelada_em          TIMESTAMPTZ,
  cancelamento_msg      TEXT,

  -- Snapshots: o cadastro muda, a apólice emitida não.
  inquilino             JSONB NOT NULL DEFAULT '{}'::jsonb,
  proprietario          JSONB NOT NULL DEFAULT '{}'::jsonb,
  endereco              JSONB NOT NULL DEFAULT '{}'::jsonb,

  payload               JSONB,
  erro                  TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- codigo_seguro é único por ambiente: homologação e produção numeram
  -- separado, como já acontece na fiança.
  UNIQUE (ambiente, seguradora, codigo_seguro)
);

CREATE INDEX IF NOT EXISTS seguro_incendio_user_idx
  ON seguro_incendio_apolices (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seguro_incendio_contrato_idx
  ON seguro_incendio_apolices (contrato_id) WHERE contrato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS seguro_incendio_imovel_idx
  ON seguro_incendio_apolices (imovel_id) WHERE imovel_id IS NOT NULL;
-- Renovação: apólices contratadas ordenadas pelo fim da vigência.
CREATE INDEX IF NOT EXISTS seguro_incendio_vigencia_idx
  ON seguro_incendio_apolices (user_id, fim_vigencia)
  WHERE status = 'contratada';

COMMENT ON TABLE seguro_incendio_apolices IS
  'Seguro incêndio: cálculo e contratação num fluxo só. Diferente da fiança, não há análise de crédito.';
COMMENT ON COLUMN seguro_incendio_apolices.seguradora IS
  'Alfa ou Porto. Vai no header `seguradora` de quase toda chamada da API de incêndio.';
COMMENT ON COLUMN seguro_incendio_apolices.tipo_vigencia IS
  '0 = anual · 1 = mensalizado. O mensalizado é o modelo que a imobiliária cobra junto do aluguel.';
COMMENT ON COLUMN seguro_incendio_apolices.tipo_cobertura IS
  '2 prédio+conteúdo · 3 só prédio · 4 prédio 90%/conteúdo 10% · 5 prédio 85%/conteúdo 15%.';
COMMENT ON COLUMN seguro_incendio_apolices.codigo_seguro IS
  'Chave para cancelar, imprimir proposta e imprimir boleto. Sem ela a apólice fica órfã na corretora.';


-- ── Faturamento ───────────────────────────────────────────────────────
-- Espelho de /listarFaturamento. É o ÚNICO endpoint de toda a integração
-- (fiança inclusive) que dá visão financeira — logo, a base de conferência
-- da comissão sobreposta que a plataforma recebe.
CREATE TABLE IF NOT EXISTS seguro_incendio_faturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  ambiente          SMALLINT NOT NULL CHECK (ambiente IN (1,2)),
  cnpj_imobiliaria  TEXT NOT NULL,
  competencia       DATE,                    -- 1º dia do mês; NULL = fatura aberta
  vigencia          TEXT NOT NULL CHECK (vigencia IN ('mensalizado','anual')),
  ramo              TEXT NOT NULL CHECK (ramo IN ('residencial','comercial')),

  codigo            TEXT,
  numero_proposta   TEXT,
  cdconseg          TEXT,
  cdemi             TEXT,
  data_cobertura    TEXT,
  inquilino_nome    TEXT,
  proprietario_nome TEXT,
  local_risco       TEXT,
  parcelas          SMALLINT,
  valor_parcela     NUMERIC(12,2),
  premio_total      NUMERIC(12,2),

  -- Liga à apólice quando o número bate; nem sempre vai bater (apólice
  -- emitida fora da plataforma aparece aqui do mesmo jeito).
  apolice_id        UUID REFERENCES seguro_incendio_apolices(id) ON DELETE SET NULL,

  sincronizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ambiente, cnpj_imobiliaria, vigencia, ramo, codigo)
);

CREATE INDEX IF NOT EXISTS seguro_incendio_faturas_user_idx
  ON seguro_incendio_faturas (user_id, competencia DESC);

COMMENT ON TABLE seguro_incendio_faturas IS
  'Espelho de /listarFaturamento. Base de conferência do override: mostra prêmio por apólice e por imobiliária.';
COMMENT ON COLUMN seguro_incendio_faturas.competencia IS
  'Mês de referência (1º dia). NULL quando é a fatura em aberto — a API só filtra por mês/ano nas fechadas.';


-- ── Documentos ────────────────────────────────────────────────────────
-- Diferente da fiança, aqui os PDFs vêm sob demanda (imprimirProposta e
-- imprimirBoleto), não empurrados por webhook. Guardamos ao baixar pra
-- não repetir a chamada a cada visualização.
CREATE TABLE IF NOT EXISTS seguro_incendio_documentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apolice_id     UUID NOT NULL REFERENCES seguro_incendio_apolices(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tipo           TEXT NOT NULL CHECK (tipo IN ('certificado','proposta','boleto')),
  num_parcela    SMALLINT,                  -- boleto: uma linha por parcela
  data_vencimento TEXT,
  data_pagamento  TEXT,

  storage_path   TEXT NOT NULL,
  tamanho_bytes  INTEGER,
  baixado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (apolice_id, tipo, num_parcela)
);

CREATE INDEX IF NOT EXISTS seguro_incendio_docs_apolice_idx
  ON seguro_incendio_documentos (apolice_id);


-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE seguro_incendio_apolices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_incendio_faturas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguro_incendio_documentos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seguro_incendio_dono ON seguro_incendio_apolices;
CREATE POLICY seguro_incendio_dono ON seguro_incendio_apolices
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS seguro_incendio_faturas_dono ON seguro_incendio_faturas;
CREATE POLICY seguro_incendio_faturas_dono ON seguro_incendio_faturas
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS seguro_incendio_docs_dono ON seguro_incendio_documentos;
CREATE POLICY seguro_incendio_docs_dono ON seguro_incendio_documentos
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ── updated_at ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_seguro_incendio_touch ON seguro_incendio_apolices;
CREATE TRIGGER trg_seguro_incendio_touch BEFORE UPDATE ON seguro_incendio_apolices
  FOR EACH ROW EXECUTE FUNCTION seguros_touch_updated_at();

NOTIFY pgrst, 'reload schema';
