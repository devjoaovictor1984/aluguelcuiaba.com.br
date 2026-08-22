-- ════════════════════════════════════════════════════════════════════
--  CRM v84 — Via final congelada no storage
--
--  Até aqui a via final (contrato + certificado) era REMONTADA a cada
--  download, a partir dos dados do banco. O pdf_hash gravado na v61 era
--  do contrato renderizado naquele instante — e nunca mais reproduzível:
--  basta o @react-pdf mudar de versão ou uma fonte medir 1pt diferente e
--  os bytes mudam. Ou seja, o hash impresso no certificado prometia uma
--  integridade que ninguém conseguia conferir.
--
--  Agora o arquivo é gerado UMA vez, sobe pro bucket privado
--  'contratos-assinados' e é servido sempre de lá. O hash passa a ser
--  do arquivo que existe de verdade, e a página /validar pode conferir
--  o PDF que a pessoa tem em mãos contra ele.
--
--  Dois hashes, de propósito:
--    pdf_hash       — do CONTRATO renderizado (o impresso no certificado).
--                     Um arquivo não pode conter o próprio hash, então
--                     esse continua sendo o da parte contratual.
--    pdf_final_hash — do ARQUIVO INTEIRO congelado. É o que a pessoa
--                     consegue calcular no PDF que recebeu.
--
--  O congelamento é preguiçoso: acontece na primeira vez que a via final
--  for gerada (o link do e-mail de conclusão já serve). Processos
--  concluídos antes da v84 congelam no próximo download.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_assinaturas
  ADD COLUMN IF NOT EXISTS pdf_final_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_final_hash TEXT,
  ADD COLUMN IF NOT EXISTS pdf_final_em   TIMESTAMPTZ;

COMMENT ON COLUMN contrato_assinaturas.pdf_final_path IS
  'Caminho da via final (contrato + certificado) no bucket privado ''contratos-assinados''. Preenchido na primeira geração; a partir daí o download serve este arquivo, sem remontar.';

COMMENT ON COLUMN contrato_assinaturas.pdf_final_hash IS
  'SHA-256 do arquivo final congelado. É o hash conferível em /validar pela pessoa que tem o PDF.';

COMMENT ON COLUMN contrato_assinaturas.pdf_hash IS
  'SHA-256 do CONTRATO renderizado (sem o certificado anexo). É o impresso no corpo do certificado. Para conferir o arquivo recebido, use pdf_final_hash.';

-- Bucket PRIVADO: a via final tem selfie e trilha de auditoria das partes.
-- Quem baixa passa pela rota, que confere dono logado ou token de signatário.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos-assinados',
  'contratos-assinados',
  false,                                   -- PRIVADO
  52428800,                                -- 50MB (contrato com fotos de vistoria pesa)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Sem policy de SELECT: ninguém lê o bucket direto, só via rota autorizada.
DROP POLICY IF EXISTS contratos_assinados_select_publico ON storage.objects;

NOTIFY pgrst, 'reload schema';
