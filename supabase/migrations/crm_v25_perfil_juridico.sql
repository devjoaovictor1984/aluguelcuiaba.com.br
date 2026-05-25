-- ════════════════════════════════════════════════════════════════════
--  CRM v25 — Dados jurídicos do perfil
--
--  Campos institucionais reutilizados em documentos (vistoria, recibo,
--  futuro contrato): razão social, CNPJ e CRECI jurídico.
--  Pessoa física só usa o `nome` e `creci`. Quem é imobiliária (PJ)
--  preenche também esses três pra cabeçalho com peso jurídico.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS creci_juridico TEXT;

COMMENT ON COLUMN perfis.razao_social IS
  'Razão social/nome jurídico da imobiliária. Aparece no cabeçalho de documentos. NULL pra pessoa física.';
COMMENT ON COLUMN perfis.cnpj IS
  'CNPJ da PJ, só números. NULL pra pessoa física.';
COMMENT ON COLUMN perfis.creci_juridico IS
  'CRECI Jurídico (ex: 14137-J). Distinto do creci pessoa física do corretor responsável.';

NOTIFY pgrst, 'reload schema';
