-- ════════════════════════════════════════════════════════════════════
--  CRM v20 — Vistorias online (entrada/saída) com assinatura digital
--
--  Fluxo:
--    1. Corretor cria vistoria de entrada/saída no painel — define
--       cômodos, itens, estado, fotos.
--    2. Marca como "enviar" → sistema gera token único (magic link 7d).
--    3. Manda o link pelo WhatsApp pro inquilino.
--    4. Inquilino abre, revisa cada item, pode adicionar observação
--       e/ou foto contestando, assina digitalmente (canvas).
--    5. Sistema fecha a vistoria, gera PDF e anexa ao contrato.
-- ════════════════════════════════════════════════════════════════════

-- ── Tabela principal ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistorias (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id              UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  status                   TEXT NOT NULL DEFAULT 'rascunho'
                              CHECK (status IN ('rascunho','enviada','assinada','recusada')),
  token                    TEXT UNIQUE,
  data_vistoria            DATE,
  observacoes_gerais       TEXT,
  qtd_chaves               INTEGER DEFAULT 0,
  qtd_controles            INTEGER DEFAULT 0,

  -- Workflow
  enviada_em               TIMESTAMPTZ,
  expira_em                TIMESTAMPTZ,
  assinada_em              TIMESTAMPTZ,
  assinada_ip              TEXT,
  assinatura_inquilino_url TEXT,
  inquilino_observacoes    TEXT,
  recusada_em              TIMESTAMPTZ,
  recusada_motivo          TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vistorias_contrato_idx
  ON vistorias (contrato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vistorias_token_idx
  ON vistorias (token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS vistorias_user_idx
  ON vistorias (user_id);

ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vistorias_dono ON vistorias;
CREATE POLICY vistorias_dono ON vistorias
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── Itens (cômodos/peças) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistoria_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id           UUID NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  comodo                TEXT NOT NULL,
  item                  TEXT NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'bom'
                          CHECK (estado IN ('perfeito','bom','regular','danificado','nao_aplicavel')),
  observacao            TEXT,
  observacao_inquilino  TEXT,
  ordem                 INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vistoria_itens_vistoria_idx
  ON vistoria_itens (vistoria_id, ordem);

ALTER TABLE vistoria_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vistoria_itens_via_vistoria ON vistoria_itens;
CREATE POLICY vistoria_itens_via_vistoria ON vistoria_itens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vistorias v
    WHERE v.id = vistoria_itens.vistoria_id AND v.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vistorias v
    WHERE v.id = vistoria_itens.vistoria_id AND v.user_id = auth.uid()
  ));


-- ── Fotos (vinculadas ao item ou à vistoria toda) ─────────────────
CREATE TABLE IF NOT EXISTS vistoria_fotos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id       UUID NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  vistoria_item_id  UUID REFERENCES vistoria_itens(id) ON DELETE CASCADE,
  arquivo_path      TEXT NOT NULL,
  origem            TEXT NOT NULL CHECK (origem IN ('corretor','inquilino')),
  legenda           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vistoria_fotos_item_idx
  ON vistoria_fotos (vistoria_item_id) WHERE vistoria_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vistoria_fotos_vistoria_idx
  ON vistoria_fotos (vistoria_id);

ALTER TABLE vistoria_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vistoria_fotos_via_vistoria ON vistoria_fotos;
CREATE POLICY vistoria_fotos_via_vistoria ON vistoria_fotos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vistorias v
    WHERE v.id = vistoria_fotos.vistoria_id AND v.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vistorias v
    WHERE v.id = vistoria_fotos.vistoria_id AND v.user_id = auth.uid()
  ));


-- ── Bucket de storage ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vistorias-fotos',
  'vistorias-fotos',
  true,                                    -- público (PDFs/HTML embedam direto)
  5242880,                                 -- 5MB por foto
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública: PDFs/links abrem direto
DROP POLICY IF EXISTS vistorias_fotos_select ON storage.objects;
CREATE POLICY vistorias_fotos_select ON storage.objects
  FOR SELECT TO public, authenticated
  USING (bucket_id = 'vistorias-fotos');

-- Corretor faz upload nas suas próprias pastas (path = {user_id}/{vistoria_id}/...)
DROP POLICY IF EXISTS vistorias_fotos_insert_corretor ON storage.objects;
CREATE POLICY vistorias_fotos_insert_corretor ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vistorias-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS vistorias_fotos_delete_corretor ON storage.objects;
CREATE POLICY vistorias_fotos_delete_corretor ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vistorias-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- (Inquilino sobe via API route com admin client; sem policy adicional)


-- ── Encerramento de contrato: chaves + caução ─────────────────────
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS chaves_entregues_em   DATE,
  ADD COLUMN IF NOT EXISTS qtd_chaves_entregues  INTEGER,
  ADD COLUMN IF NOT EXISTS caucao_devolvida      BOOLEAN,
  ADD COLUMN IF NOT EXISTS vistoria_entrada_id   UUID REFERENCES vistorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vistoria_saida_id     UUID REFERENCES vistorias(id) ON DELETE SET NULL;


-- ── Trigger pra atualizar updated_at em vistorias ─────────────────
CREATE OR REPLACE FUNCTION vistorias_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vistorias_touch ON vistorias;
CREATE TRIGGER trg_vistorias_touch
  BEFORE UPDATE ON vistorias
  FOR EACH ROW
  EXECUTE FUNCTION vistorias_touch_updated_at();

NOTIFY pgrst, 'reload schema';
