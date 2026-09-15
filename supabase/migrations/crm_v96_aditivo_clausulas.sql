-- ─────────────────────────────────────────────────────────────────────
-- v96 · Cláusulas do termo aditivo editáveis
--
-- POR QUE: só o objeto (cláusula 1ª) era editável. Ratificação, foro e o
-- fechamento eram fixos no código — e o fechamento ainda falava em
-- "2 (duas) vias" de papel, quando o aditivo agora é assinado pela
-- plataforma, com certificado de assinatura.
--
-- clausulas: JSONB, lista de { titulo, texto } — as cláusulas da 2ª em
--   diante. NULL = texto padrão (ratificação, assinatura eletrônica,
--   foro), montado em src/lib/crm/aditivo-clausulas.ts. Gravar NULL
--   quando igual ao padrão é de propósito: o aditivo continua seguindo o
--   padrão (e o foro da imobiliária) em vez de congelar uma cópia.
-- fechamento: o "E, por estarem assim justas..." antes da data. NULL = padrão.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_aditivos
  ADD COLUMN IF NOT EXISTS clausulas  JSONB,
  ADD COLUMN IF NOT EXISTS fechamento TEXT;

ALTER TABLE contratos_administracao_aditivos
  ADD COLUMN IF NOT EXISTS clausulas  JSONB,
  ADD COLUMN IF NOT EXISTS fechamento TEXT;

COMMENT ON COLUMN contratos_aditivos.clausulas IS
  'Cláusulas da 2ª em diante, [{titulo, texto}]. NULL = texto padrão (aditivo-clausulas.ts).';
COMMENT ON COLUMN contratos_aditivos.fechamento IS
  'Parágrafo de fechamento antes da data. NULL = texto padrão.';
COMMENT ON COLUMN contratos_administracao_aditivos.clausulas IS
  'Cláusulas da 2ª em diante, [{titulo, texto}]. NULL = texto padrão (aditivo-clausulas.ts).';
COMMENT ON COLUMN contratos_administracao_aditivos.fechamento IS
  'Parágrafo de fechamento antes da data. NULL = texto padrão.';

NOTIFY pgrst, 'reload schema';
