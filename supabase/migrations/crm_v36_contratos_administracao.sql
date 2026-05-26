-- ════════════════════════════════════════════════════════════════════
--  CRM v36 — Contratos de Administração Imobiliária
--
--  Vínculo entre PROPRIETÁRIO e IMOBILIATTO/CORRETOR. Tem vida própria,
--  independente do contrato de locação. Um imóvel pode trocar de
--  inquilino mas o contrato de administração continua.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contratos_administracao (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo              TEXT NOT NULL,                                 -- ex: "ADM2026-001"

  imovel_id           UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  proprietario_id     UUID NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,

  -- Prazo
  data_inicio                 DATE NOT NULL,
  data_termino                DATE,                                  -- NULL = prazo indeterminado
  prazo_meses                 INTEGER,
  renovacao_automatica        BOOLEAN NOT NULL DEFAULT TRUE,

  -- Taxa de administração
  taxa_tipo                   TEXT NOT NULL DEFAULT 'percentual'
                              CHECK (taxa_tipo IN ('percentual','fixo')),
  taxa_valor                  NUMERIC(12,2) NOT NULL DEFAULT 10,    -- 10% ou R$ 10
  primeira_parcela_cheia      BOOLEAN NOT NULL DEFAULT FALSE,        -- 1ª parcela 100% pro corretor

  -- Repasse
  dia_repasse                 SMALLINT CHECK (dia_repasse BETWEEN 1 AND 31),
  forma_repasse               TEXT,                                  -- 'pix','transferencia',etc.

  -- Exclusividade
  exclusividade               BOOLEAN NOT NULL DEFAULT TRUE,

  -- Rescisão
  multa_rescisao_meses        INTEGER DEFAULT 3,                     -- multa = N meses de taxa
  aviso_previo_dias           INTEGER NOT NULL DEFAULT 30,

  -- Status
  status                      TEXT NOT NULL DEFAULT 'ativo'
                              CHECK (status IN ('ativo','encerrado','rescindido','rascunho')),
  status_data                 TIMESTAMPTZ DEFAULT NOW(),
  observacoes                 TEXT,

  -- Vínculo opcional ao contrato de locação atual (apenas referencial)
  contrato_locacao_atual_id   UUID REFERENCES contratos_locacao(id) ON DELETE SET NULL,

  deleted_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_contratos_admin_user
  ON contratos_administracao (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_admin_proprietario
  ON contratos_administracao (proprietario_id);
CREATE INDEX IF NOT EXISTS idx_contratos_admin_imovel
  ON contratos_administracao (imovel_id);

ALTER TABLE contratos_administracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contratos_admin_owner ON contratos_administracao;
CREATE POLICY contratos_admin_owner ON contratos_administracao
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION contratos_administracao_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contratos_administracao_updated_at ON contratos_administracao;
CREATE TRIGGER contratos_administracao_updated_at
  BEFORE UPDATE ON contratos_administracao
  FOR EACH ROW EXECUTE FUNCTION contratos_administracao_touch_updated_at();


-- ─── Adiciona tipo 'administracao' no CHECK do contrato_clausulas ──
ALTER TABLE contrato_clausulas
  DROP CONSTRAINT IF EXISTS contrato_clausulas_tipo_check;

ALTER TABLE contrato_clausulas
  ADD CONSTRAINT contrato_clausulas_tipo_check
  CHECK (tipo IN (
    'generica',
    'sem_garantia',
    'caucao',
    'fiador',
    'seguro_fianca',
    'seguro_incendio',
    'adicional',
    'administracao'
  ));


-- ─── Gerações do contrato de administração ─────────────────────────
CREATE TABLE IF NOT EXISTS contrato_admin_geracoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_admin_id   UUID NOT NULL REFERENCES contratos_administracao(id) ON DELETE CASCADE,

  clausula_ids        UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  testemunha_ids      UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  anexo_documento_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  pdf_url             TEXT,
  pdf_path            TEXT,
  pdf_assinado_url    TEXT,
  pdf_assinado_path   TEXT,
  gerado_em           TIMESTAMPTZ,
  assinado_em         TIMESTAMPTZ,

  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','gerado','assinado','arquivado')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contrato_admin_geracoes
  ON contrato_admin_geracoes (contrato_admin_id, created_at DESC);

ALTER TABLE contrato_admin_geracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contrato_admin_geracoes_owner ON contrato_admin_geracoes;
CREATE POLICY contrato_admin_geracoes_owner ON contrato_admin_geracoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION contrato_admin_geracoes_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contrato_admin_geracoes_updated_at ON contrato_admin_geracoes;
CREATE TRIGGER contrato_admin_geracoes_updated_at
  BEFORE UPDATE ON contrato_admin_geracoes
  FOR EACH ROW EXECUTE FUNCTION contrato_admin_geracoes_touch_updated_at();

NOTIFY pgrst, 'reload schema';
