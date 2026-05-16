-- ═══════════════════════════════════════════════════════════════════════
--  CRM de Locação — Schema inicial
-- ═══════════════════════════════════════════════════════════════════════
--  Rode este SQL completo no Supabase → SQL Editor.
--  Tudo usa IF NOT EXISTS / IF EXISTS para ser idempotente.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Feature flag ──────────────────────────────────────────────────────
ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS crm_ativo BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN perfis.crm_ativo IS
  'Habilita acesso ao CRM de locação. Liberado manualmente durante o piloto.';

-- ─── Pessoas (proprietário / inquilino / fiador / testemunha) ──────────
CREATE TABLE IF NOT EXISTS pessoas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('proprietario','inquilino','fiador','testemunha','outro')),

  nome          TEXT NOT NULL,
  cpf_cnpj      TEXT,
  rg            TEXT,
  data_nascimento DATE,
  estado_civil  TEXT,
  profissao     TEXT,
  nacionalidade TEXT DEFAULT 'Brasileira',

  email         TEXT,
  telefone      TEXT,
  whatsapp      TEXT,

  endereco_cep        TEXT,
  endereco_logradouro TEXT,
  endereco_numero     TEXT,
  endereco_complemento TEXT,
  endereco_bairro     TEXT,
  endereco_cidade     TEXT,
  endereco_estado     TEXT,

  observacoes   TEXT,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pessoas_user ON pessoas(user_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo ON pessoas(tipo);
CREATE INDEX IF NOT EXISTS idx_pessoas_cpf  ON pessoas(cpf_cnpj);

-- ─── Contratos de locação ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contratos_locacao (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,                                   -- "2025CT001" (gerado)

  imovel_id     UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  inquilino_id  UUID REFERENCES pessoas(id) ON DELETE RESTRICT,
  proprietario_id UUID REFERENCES pessoas(id) ON DELETE RESTRICT,

  -- Valores
  valor_aluguel               NUMERIC(12,2) NOT NULL,
  valor_seguro_fianca_mensal  NUMERIC(12,2) DEFAULT 0,
  valor_seguro_incendio_anual NUMERIC(12,2),                     -- opcional (proprietário pode ter)
  seguro_incendio_data        DATE,                              -- quando o anual vence/paga
  iptu_mensal                 NUMERIC(12,2) DEFAULT 0,
  condominio_mensal           NUMERIC(12,2) DEFAULT 0,

  -- Administração (taxa da imobiliária)
  taxa_admin_tipo  TEXT NOT NULL DEFAULT 'percentual'
                   CHECK (taxa_admin_tipo IN ('percentual','fixo')),
  taxa_admin_valor NUMERIC(12,2) NOT NULL DEFAULT 10,             -- 10 = 10% ou R$ 10

  -- Regra: 1ª parcela 100% pro corretor (opcional por contrato)
  primeira_parcela_cheia BOOLEAN NOT NULL DEFAULT FALSE,

  -- Garantia
  garantia_tipo  TEXT NOT NULL CHECK (garantia_tipo IN ('fiador','caucao','seguro_fianca','sem_garantia')),
  fiador_id            UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  caucao_valor         NUMERIC(12,2),
  seguro_fianca_seguradora TEXT,
  seguro_fianca_apolice    TEXT,

  -- Datas e duração
  data_inicio              DATE NOT NULL,
  data_primeiro_aluguel    DATE NOT NULL,                         -- quando começa a cobrança
  data_termino             DATE,                                  -- pode ser indeterminado
  duracao_meses            INTEGER,
  dia_vencimento           SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),

  -- Status
  status         TEXT NOT NULL DEFAULT 'ativo'
                 CHECK (status IN ('ativo','encerrado','rescindido','inadimplente','rascunho')),
  status_data    TIMESTAMPTZ DEFAULT NOW(),

  -- Operacional
  forma_pagamento TEXT DEFAULT 'boleto'
                  CHECK (forma_pagamento IN ('boleto','pix','transferencia','dinheiro','cheque')),
  vistoria_ok          BOOLEAN DEFAULT FALSE,
  termo_chaves_ok      BOOLEAN DEFAULT FALSE,
  observacoes          TEXT,
  clausulas_extras     TEXT,

  -- Reajuste
  indice_reajuste TEXT,                                           -- IGPM, IPCA, INPC
  data_proximo_reajuste DATE,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_contratos_user   ON contratos_locacao(user_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos_locacao(status);
CREATE INDEX IF NOT EXISTS idx_contratos_imovel ON contratos_locacao(imovel_id);

-- ─── Parcelas mensais ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas_aluguel (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,

  numero      SMALLINT NOT NULL,                                  -- 1, 2, 3...
  mes_referencia DATE NOT NULL,                                   -- 1º dia do mês
  vencimento  DATE NOT NULL,

  -- Valores calculados
  valor_aluguel               NUMERIC(12,2) NOT NULL,
  valor_seguro                NUMERIC(12,2) DEFAULT 0,
  valor_iptu                  NUMERIC(12,2) DEFAULT 0,
  valor_condominio            NUMERIC(12,2) DEFAULT 0,
  valor_total                 NUMERIC(12,2) NOT NULL,             -- soma dos componentes do boleto
  valor_comissao              NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_repasse_proprietario  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Pagamento
  data_pagamento  DATE,
  valor_pago      NUMERIC(12,2),
  juros_multa     NUMERIC(12,2) DEFAULT 0,
  desconto        NUMERIC(12,2) DEFAULT 0,

  status_pagamento TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status_pagamento IN ('pendente','pago','atrasado','isento','renegociado')),
  status_repasse   TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status_repasse IN ('pendente','pago')),
  status_seguro    TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status_seguro IN ('pendente','pago','sem_seguro')),
  boleto_enviado   BOOLEAN DEFAULT FALSE,

  numero_boleto   TEXT,                                           -- AAMMatNN
  numero_recibo   SMALLINT,                                       -- sequencial por contrato
  observacoes     TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (contrato_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_parcelas_contrato     ON parcelas_aluguel(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_status_pag   ON parcelas_aluguel(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento   ON parcelas_aluguel(vencimento);

-- ─── Documentos do contrato (contrato PDF, apólice, etc.) ──────────────
CREATE TABLE IF NOT EXISTS contratos_documentos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
              CHECK (tipo IN ('contrato','apolice_fianca','seguro_incendio','vistoria','termo_chaves','outro')),
  nome        TEXT NOT NULL,
  url         TEXT NOT NULL,
  tamanho     INTEGER,
  mime_type   TEXT,
  observacoes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_contrato ON contratos_documentos(contrato_id);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE pessoas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_locacao    ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_aluguel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_documentos ENABLE ROW LEVEL SECURITY;

-- Pessoas: usuário só vê / mexe nas próprias
DROP POLICY IF EXISTS pessoas_owner_all ON pessoas;
CREATE POLICY pessoas_owner_all ON pessoas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Contratos: usuário só vê / mexe nos próprios
DROP POLICY IF EXISTS contratos_owner_all ON contratos_locacao;
CREATE POLICY contratos_owner_all ON contratos_locacao
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Parcelas: através do contrato
DROP POLICY IF EXISTS parcelas_via_contrato ON parcelas_aluguel;
CREATE POLICY parcelas_via_contrato ON parcelas_aluguel
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contratos_locacao c
                 WHERE c.id = parcelas_aluguel.contrato_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contratos_locacao c
                      WHERE c.id = parcelas_aluguel.contrato_id AND c.user_id = auth.uid()));

-- Documentos: idem
DROP POLICY IF EXISTS documentos_via_contrato ON contratos_documentos;
CREATE POLICY documentos_via_contrato ON contratos_documentos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contratos_locacao c
                 WHERE c.id = contratos_documentos.contrato_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contratos_locacao c
                      WHERE c.id = contratos_documentos.contrato_id AND c.user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- Storage bucket para documentos
-- ═══════════════════════════════════════════════════════════════════════
-- Crie no painel Supabase → Storage:
--   Nome: contratos-docs
--   Public: false (privado, acessado via signed URL)
-- ═══════════════════════════════════════════════════════════════════════
