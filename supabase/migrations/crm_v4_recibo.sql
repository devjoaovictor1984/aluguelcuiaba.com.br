-- ════════════════════════════════════════════════════════════════════
--  CRM v4 — Personalização do recibo
--  Logo, nome do emitente e assinatura digital independentes do portal.
--  Bucket privado por usuário (path = {user_id}/logo|assinatura.{ext}).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS recibo_logo_url           TEXT,
  ADD COLUMN IF NOT EXISTS recibo_emitente_nome      TEXT,
  ADD COLUMN IF NOT EXISTS recibo_assinatura_url     TEXT,
  ADD COLUMN IF NOT EXISTS recibo_mostrar_linha      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recibo_assinatura_sobre_linha BOOLEAN NOT NULL DEFAULT TRUE;

-- Bucket público (URLs diretas no PDF) — somente o dono pode escrever/apagar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-emitente',
  'crm-emitente',
  true,            -- leitura pública (PDF embute por URL)
  3145728,         -- 3MB suficiente pra logo/assinatura
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS crm_emitente_select_public ON storage.objects;
CREATE POLICY crm_emitente_select_public ON storage.objects
  FOR SELECT TO public, authenticated
  USING (bucket_id = 'crm-emitente');

DROP POLICY IF EXISTS crm_emitente_insert ON storage.objects;
CREATE POLICY crm_emitente_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-emitente'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS crm_emitente_update ON storage.objects;
CREATE POLICY crm_emitente_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'crm-emitente'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS crm_emitente_delete ON storage.objects;
CREATE POLICY crm_emitente_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-emitente'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
