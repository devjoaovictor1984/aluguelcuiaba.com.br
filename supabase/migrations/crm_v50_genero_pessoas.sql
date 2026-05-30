-- ════════════════════════════════════════════════════════════════════
--  CRM v50 — Gênero para redação contratual
--
--  Permite que os contratos saiam com a flexão correta de gênero na
--  qualificação das partes ("brasileira", "portadora", "domiciliada",
--  "denominada LOCATÁRIA") em vez do feio "brasileiro(a)".
--
--  Valores: 'M' (masculino) · 'F' (feminino) · 'N' (neutro/não informado).
--  PJ (CNPJ 14 dígitos) é tratada automaticamente como feminina pelo
--  renderer ("a empresa", "denominada CONTRATANTE"), sem depender deste
--  campo.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS genero TEXT NOT NULL DEFAULT 'N'
  CHECK (genero IN ('M','F','N'));

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS conjuge_genero TEXT
  CHECK (conjuge_genero IN ('M','F','N'));

COMMENT ON COLUMN pessoas.genero IS
  'Gênero para flexão na redação dos contratos. M=masculino, F=feminino, N=neutro/não informado.';
COMMENT ON COLUMN pessoas.conjuge_genero IS
  'Gênero do cônjuge (se houver) para a redação contratual.';

NOTIFY pgrst, 'reload schema';
