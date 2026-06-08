-- ════════════════════════════════════════════════════════════════════
--  CRM v51 — Termo de entrega de chaves (assinatura dupla + selfie)
--
--  Fecha o ciclo de encerramento do contrato. Diferente da vistoria
--  (que tem 1 assinante), o termo de entrega é assinado pelas DUAS
--  partes — LOCATÁRIO (quem devolve) e LOCADOR/ADMINISTRADORA (quem
--  recebe) — com selfie pra reforçar o valor probatório.
--
--  Fluxo linear:
--    1. Administradora cria o termo no painel a partir do contrato,
--       define qtd de chaves/controles e estado de entrega (pode puxar
--       da vistoria de saída).
--    2. Marca "enviar" → gera token (magic link, validade configurável).
--    3. Locatário abre o link, tira selfie, assina (canvas) → o termo
--       fica 'assinado_locatario'.
--    4. Administradora confirma o recebimento assinando no painel
--       (selfie opcional) → 'assinado'. Nesse momento grava
--       chaves_entregues_em / qtd_chaves_entregues no contrato.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS termos_entrega_chaves (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id               UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  vistoria_saida_id         UUID REFERENCES vistorias(id) ON DELETE SET NULL,

  status                    TEXT NOT NULL DEFAULT 'rascunho'
                              CHECK (status IN ('rascunho','enviada','assinado_locatario','assinado','recusada')),
  token                     TEXT UNIQUE,
  data_entrega              DATE,
  qtd_chaves_entregues      INTEGER DEFAULT 0,
  qtd_controles_entregues   INTEGER DEFAULT 0,
  estado_entrega            TEXT,           -- estado geral do imóvel na devolução (texto livre)
  observacoes               TEXT,

  -- Workflow
  enviada_em                TIMESTAMPTZ,
  expira_em                 TIMESTAMPTZ,
  recusada_em               TIMESTAMPTZ,
  recusada_motivo           TEXT,

  -- Assinatura do LOCATÁRIO (quem devolve as chaves)
  assinatura_locatario_url  TEXT,
  selfie_locatario_url      TEXT,
  assinado_locatario_em     TIMESTAMPTZ,
  assinado_locatario_ip     TEXT,
  observacoes_locatario     TEXT,

  -- Assinatura do LOCADOR/ADMINISTRADORA (quem recebe as chaves)
  assinatura_locador_url    TEXT,
  selfie_locador_url        TEXT,
  assinado_locador_em       TIMESTAMPTZ,
  assinado_locador_ip       TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS termos_chaves_contrato_idx
  ON termos_entrega_chaves (contrato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS termos_chaves_token_idx
  ON termos_entrega_chaves (token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS termos_chaves_user_idx
  ON termos_entrega_chaves (user_id);

ALTER TABLE termos_entrega_chaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS termos_chaves_dono ON termos_entrega_chaves;
CREATE POLICY termos_chaves_dono ON termos_entrega_chaves
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── Bucket de storage (assinaturas + selfies) ─────────────────────
-- Público pra que o PDF (renderToBuffer) embede as imagens direto.
-- Path: {user_id}/{termo_id}/... (UUID na pasta dificulta enumeração).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'termos-chaves',
  'termos-chaves',
  true,
  5242880,                                 -- 5MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (PDFs/links abrem direto)
DROP POLICY IF EXISTS termos_chaves_select ON storage.objects;
CREATE POLICY termos_chaves_select ON storage.objects
  FOR SELECT TO public, authenticated
  USING (bucket_id = 'termos-chaves');

-- Administradora sobe nas próprias pastas (assinatura/selfie do locador)
DROP POLICY IF EXISTS termos_chaves_insert_dono ON storage.objects;
CREATE POLICY termos_chaves_insert_dono ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'termos-chaves'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS termos_chaves_delete_dono ON storage.objects;
CREATE POLICY termos_chaves_delete_dono ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'termos-chaves'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- (Locatário sobe selfie/assinatura via server action com admin client; sem policy adicional)


-- ── Trigger pra atualizar updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION termos_chaves_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_termos_chaves_touch ON termos_entrega_chaves;
CREATE TRIGGER trg_termos_chaves_touch
  BEFORE UPDATE ON termos_entrega_chaves
  FOR EACH ROW
  EXECUTE FUNCTION termos_chaves_touch_updated_at();

NOTIFY pgrst, 'reload schema';
