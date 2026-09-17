-- ─────────────────────────────────────────────────────────────────────
-- v97 · Apólices (incêndio e fiança) anexadas ao contrato
--
-- POR QUE: enquanto a emissão não sai do nosso painel, o seguro é feito
-- na plataforma da seguradora, o PDF é baixado e fica no computador de
-- alguém. Quando o inquilino ou o proprietário pede a apólice, ninguém
-- acha. Aqui ela fica junto do contrato, que é onde se procura.
--
-- `contratos_documentos` já existia desde crm_locacao.sql — com
-- 'apolice_fianca' e 'seguro_incendio' no CHECK — mas nunca foi usada
-- por nenhuma tela: está vazia. Então dá pra ajustar o formato sem
-- migrar dado nenhum.
--
-- O que muda:
--   · user_id      — o padrão do projeto (as actions usam o admin client
--                    e filtram por user_id; RLS por join não basta).
--   · arquivo_path — bucket PRIVADO com signed URL, em vez de `url`
--                    pública. Apólice traz CPF, endereço e valores; era
--                    o que o próprio comentário da migration original já
--                    mandava fazer ("Public: false").
--   · dados da apólice — seguradora, número e vigência, pra localizar e
--                    pra saber se ainda está valendo sem abrir o PDF.
--   · origem + seguro_apolice_id — quando a emissão pela plataforma
--                    entrar, a apólice aparece no MESMO lugar, marcada
--                    como 'plataforma' e ligada a seguro_incendio_apolices.
--                    A tela não muda; só para de precisar do upload.
--
-- `url` vira nullable e fica só como legado (nunca houve linha).
--
-- Bucket: criar no painel Supabase → Storage → New bucket
--   Nome: contratos-docs   ·   Public: OFF
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_documentos
  ADD COLUMN IF NOT EXISTS user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS arquivo_path      TEXT,
  ADD COLUMN IF NOT EXISTS nome_original     TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_bytes     BIGINT,
  ADD COLUMN IF NOT EXISTS seguradora        TEXT,
  ADD COLUMN IF NOT EXISTS apolice_numero    TEXT,
  ADD COLUMN IF NOT EXISTS vigencia_inicio   DATE,
  ADD COLUMN IF NOT EXISTS vigencia_fim      DATE,
  ADD COLUMN IF NOT EXISTS origem            TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS seguro_apolice_id UUID REFERENCES seguro_incendio_apolices(id) ON DELETE SET NULL;

-- `url` era NOT NULL e pressupunha bucket público; agora o arquivo vive
-- em arquivo_path. A tabela está vazia, então soltar a trava é seguro.
ALTER TABLE contratos_documentos ALTER COLUMN url DROP NOT NULL;

-- 'seguro_incendio' virou 'apolice_incendio': fica no par de
-- 'apolice_fianca' e diz o que a linha é (uma apólice), não o assunto.
ALTER TABLE contratos_documentos DROP CONSTRAINT IF EXISTS contratos_documentos_tipo_check;
ALTER TABLE contratos_documentos
  ADD CONSTRAINT contratos_documentos_tipo_check
  CHECK (tipo IN ('apolice_incendio','apolice_fianca','contrato','vistoria','termo_chaves','outro'));

ALTER TABLE contratos_documentos DROP CONSTRAINT IF EXISTS contratos_documentos_origem_check;
ALTER TABLE contratos_documentos
  ADD CONSTRAINT contratos_documentos_origem_check
  CHECK (origem IN ('manual','plataforma'));

CREATE INDEX IF NOT EXISTS idx_contratos_documentos_user ON contratos_documentos(user_id);
CREATE INDEX IF NOT EXISTS idx_contratos_documentos_tipo ON contratos_documentos(contrato_id, tipo);

-- RLS: o dono do contrato continua mandando, mas agora o user_id da
-- própria linha também precisa bater — senão o admin client, que ignora
-- RLS, ficaria sem rede de proteção nenhuma.
DROP POLICY IF EXISTS documentos_via_contrato ON contratos_documentos;
CREATE POLICY documentos_via_contrato ON contratos_documentos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contratos_locacao c
                 WHERE c.id = contratos_documentos.contrato_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contratos_locacao c
                      WHERE c.id = contratos_documentos.contrato_id AND c.user_id = auth.uid()));

COMMENT ON COLUMN contratos_documentos.arquivo_path IS
  'Caminho no bucket privado contratos-docs. Exibir sempre por signed URL.';
COMMENT ON COLUMN contratos_documentos.origem IS
  'manual = PDF baixado da seguradora e subido aqui; plataforma = emitido pelo painel.';
COMMENT ON COLUMN contratos_documentos.seguro_apolice_id IS
  'Preenchido quando a apólice nasceu em seguro_incendio_apolices (emissão pelo painel).';

NOTIFY pgrst, 'reload schema';
