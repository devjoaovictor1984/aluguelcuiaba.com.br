-- ════════════════════════════════════════════════════════════════════
--  CRM v2 — consolidado
--  Roda este arquivo inteiro no SQL Editor do Supabase de uma vez.
--  É idempotente: pode rodar várias vezes sem erro.
--
--  Recursos:
--   1. Faixa "ALUGADO" + listagem com janela de 30 dias
--   2. Sincronização automática imovel ↔ contrato
--   3. Renovação e encerramento de contratos
--   4. Moradores adicionais por contrato
--   5. Documentos pessoais (storage + tabela)
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. IMÓVEL ALUGADO: data_alugado + trigger + filtro 30 dias
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS data_alugado TIMESTAMPTZ;

-- Backfill: imóveis já alugados sem data ganham updated_at (ou created_at).
UPDATE imoveis
SET data_alugado = COALESCE(updated_at, created_at)
WHERE status = 'alugado' AND data_alugado IS NULL;

-- Trigger: marca/limpa data_alugado conforme transição de status.
CREATE OR REPLACE FUNCTION imoveis_marcar_alugado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'alugado' AND (OLD.status IS DISTINCT FROM 'alugado') THEN
    NEW.data_alugado := NOW();
  END IF;

  IF OLD.status = 'alugado' AND NEW.status <> 'alugado' THEN
    NEW.data_alugado := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_imoveis_marcar_alugado ON imoveis;
CREATE TRIGGER trg_imoveis_marcar_alugado
  BEFORE UPDATE OF status ON imoveis
  FOR EACH ROW
  EXECUTE FUNCTION imoveis_marcar_alugado();

CREATE INDEX IF NOT EXISTS imoveis_data_alugado_idx
  ON imoveis (data_alugado)
  WHERE status = 'alugado';


-- ─────────────────────────────────────────────────────────────────────
-- 2. SINCRONIZAÇÃO imoveis.status ↔ contratos_locacao
-- ─────────────────────────────────────────────────────────────────────
-- Quando há contrato ativo no imóvel → imovel.status = 'alugado'.
-- Quando o último contrato ativo sai → volta pra 'ativo'.
-- Preserva 'pausado'/'expirado'/'rascunho' (que o anunciante pode ter setado manualmente).

CREATE OR REPLACE FUNCTION sincronizar_status_imovel()
RETURNS TRIGGER AS $$
DECLARE
  imovel_uuid UUID;
  tem_ativo BOOLEAN;
  status_atual TEXT;
BEGIN
  imovel_uuid := COALESCE(NEW.imovel_id, OLD.imovel_id);
  IF imovel_uuid IS NULL THEN RETURN NULL; END IF;

  SELECT EXISTS(
    SELECT 1 FROM contratos_locacao
    WHERE imovel_id = imovel_uuid AND status = 'ativo'
  ) INTO tem_ativo;

  SELECT status INTO status_atual FROM imoveis WHERE id = imovel_uuid;

  IF tem_ativo AND status_atual <> 'alugado' THEN
    UPDATE imoveis SET status = 'alugado' WHERE id = imovel_uuid;
  ELSIF (NOT tem_ativo) AND status_atual = 'alugado' THEN
    UPDATE imoveis SET status = 'ativo' WHERE id = imovel_uuid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contratos_sync_imovel ON contratos_locacao;
CREATE TRIGGER trg_contratos_sync_imovel
  AFTER INSERT OR UPDATE OF status, imovel_id OR DELETE ON contratos_locacao
  FOR EACH ROW
  EXECUTE FUNCTION sincronizar_status_imovel();


-- ─────────────────────────────────────────────────────────────────────
-- 3. RENOVAÇÃO E ENCERRAMENTO de contratos
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS motivo_encerramento TEXT,
  ADD COLUMN IF NOT EXISTS data_encerramento DATE,
  ADD COLUMN IF NOT EXISTS contrato_anterior_id UUID
    REFERENCES contratos_locacao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contratos_locacao_anterior_idx
  ON contratos_locacao (contrato_anterior_id)
  WHERE contrato_anterior_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- 4. MORADORES ADICIONAIS por contrato (N:N pessoas × contratos)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contratos_moradores (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id   UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  pessoa_id     UUID NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  parentesco    TEXT NOT NULL CHECK (parentesco IN (
    'conjuge','filho','pai_mae','irmao','socio','dependente','outro'
  )),
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (contrato_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS contratos_moradores_contrato_idx
  ON contratos_moradores (contrato_id);
CREATE INDEX IF NOT EXISTS contratos_moradores_pessoa_idx
  ON contratos_moradores (pessoa_id);

ALTER TABLE contratos_moradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contratos_moradores_select ON contratos_moradores;
CREATE POLICY contratos_moradores_select ON contratos_moradores
  FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM contratos_locacao c
    WHERE c.id = contratos_moradores.contrato_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS contratos_moradores_insert ON contratos_moradores;
CREATE POLICY contratos_moradores_insert ON contratos_moradores
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS(
    SELECT 1 FROM contratos_locacao c
    WHERE c.id = contratos_moradores.contrato_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS contratos_moradores_update ON contratos_moradores;
CREATE POLICY contratos_moradores_update ON contratos_moradores
  FOR UPDATE TO authenticated
  USING (EXISTS(
    SELECT 1 FROM contratos_locacao c
    WHERE c.id = contratos_moradores.contrato_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS contratos_moradores_delete ON contratos_moradores;
CREATE POLICY contratos_moradores_delete ON contratos_moradores
  FOR DELETE TO authenticated
  USING (EXISTS(
    SELECT 1 FROM contratos_locacao c
    WHERE c.id = contratos_moradores.contrato_id AND c.user_id = auth.uid()
  ));


-- ─────────────────────────────────────────────────────────────────────
-- 5. DOCUMENTOS PESSOAIS por pessoa (tabela + bucket privado)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pessoas_documentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id     UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN (
    'rg','cpf','cnh','passaporte',
    'comprovante_renda','comprovante_residencia',
    'contracheque','extrato_bancario','imposto_renda',
    'certidao_casamento','certidao_nascimento',
    'foto','outro'
  )),
  arquivo_path  TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho_bytes INTEGER,
  mime_type     TEXT,
  validade      DATE,
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pessoas_documentos_pessoa_idx
  ON pessoas_documentos (pessoa_id);
CREATE INDEX IF NOT EXISTS pessoas_documentos_user_idx
  ON pessoas_documentos (user_id);

ALTER TABLE pessoas_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pessoas_documentos_select ON pessoas_documentos;
CREATE POLICY pessoas_documentos_select ON pessoas_documentos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS pessoas_documentos_insert ON pessoas_documentos;
CREATE POLICY pessoas_documentos_insert ON pessoas_documentos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pessoas_documentos_update ON pessoas_documentos;
CREATE POLICY pessoas_documentos_update ON pessoas_documentos
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS pessoas_documentos_delete ON pessoas_documentos;
CREATE POLICY pessoas_documentos_delete ON pessoas_documentos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Bucket privado pros arquivos: 10MB, imagens + PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-pessoas',
  'documentos-pessoas',
  false,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: dono = primeiro segmento do path (user_id::text)
DROP POLICY IF EXISTS docs_pessoas_select ON storage.objects;
CREATE POLICY docs_pessoas_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-pessoas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS docs_pessoas_insert ON storage.objects;
CREATE POLICY docs_pessoas_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-pessoas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS docs_pessoas_delete ON storage.objects;
CREATE POLICY docs_pessoas_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-pessoas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─────────────────────────────────────────────────────────────────────
-- Recarrega o cache do PostgREST (Supabase) pra refletir colunas novas
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
