-- ════════════════════════════════════════════════════════════════════
--  CRM v32 — Gerações de contrato (Fase B2 + C1)
--
--  Cada vez que o corretor monta o contrato no editor visual, salva uma
--  "geração": qual modalidade de seguro incêndio entrou, se permite
--  saída sem multa após 12 meses, qual a ordem das cláusulas e onde
--  está o PDF gerado.
--
--  contratos_locacao.garantia_tipo já existe (caucao/fiador/etc.) e é
--  reusado — não duplica aqui.
--
--  1 contrato pode ter várias gerações (versões), mas a "ativa" é a
--  última criada (status='gerado' ou 'rascunho' mais recente).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrato_geracoes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id        UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,

  -- Opções de montagem
  tipo_seguro_incendio TEXT NOT NULL DEFAULT 'dispensado'
                       CHECK (tipo_seguro_incendio IN ('dispensado','cobrado_parte','embutido_pacote')),
  saida_sem_multa_12m  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Ordem final das cláusulas selecionadas (array de UUIDs em contrato_clausulas)
  clausula_ids        UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  -- Anexos selecionados (array de UUIDs em pessoas_documentos)
  anexo_documento_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  -- Resultado
  pdf_url            TEXT,                             -- URL pública do PDF gerado
  pdf_path           TEXT,                             -- path no storage pra delete
  gerado_em          TIMESTAMPTZ,

  status             TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','gerado','assinado','arquivado')),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contrato_geracoes_contrato_idx
  ON contrato_geracoes (contrato_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contrato_geracoes_user_idx
  ON contrato_geracoes (user_id, created_at DESC);

ALTER TABLE contrato_geracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contrato_geracoes_owner ON contrato_geracoes;
CREATE POLICY contrato_geracoes_owner ON contrato_geracoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION contrato_geracoes_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contrato_geracoes_updated_at ON contrato_geracoes;
CREATE TRIGGER contrato_geracoes_updated_at
  BEFORE UPDATE ON contrato_geracoes
  FOR EACH ROW EXECUTE FUNCTION contrato_geracoes_touch_updated_at();

-- ─── Storage bucket pros PDFs de contrato ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos-pdf',
  'contratos-pdf',
  true,
  20971520,                                 -- 20MB por contrato (com anexos)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS contratos_pdf_select ON storage.objects;
CREATE POLICY contratos_pdf_select ON storage.objects
  FOR SELECT TO public, authenticated
  USING (bucket_id = 'contratos-pdf');

DROP POLICY IF EXISTS contratos_pdf_insert ON storage.objects;
CREATE POLICY contratos_pdf_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contratos-pdf'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS contratos_pdf_delete ON storage.objects;
CREATE POLICY contratos_pdf_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contratos-pdf'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
