-- ════════════════════════════════════════════════════════════════════
--  CRM v52 — Selfie na assinatura da vistoria
--
--  Reaproveita o módulo de selfie do termo de entrega de chaves. O
--  inquilino tira uma selfie ao assinar a vistoria, reforçando o valor
--  probatório (prova quem estava com o aparelho na hora). A imagem vai
--  pro bucket já existente 'vistorias-fotos'.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS selfie_inquilino_url TEXT;

NOTIFY pgrst, 'reload schema';
