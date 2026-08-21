-- ════════════════════════════════════════════════════════════════════
--  CRM v82 — Selfie da assinatura de contrato no bucket PRIVADO
--
--  Vistoria e termo de entrega já guardam a selfie no bucket privado
--  'selfies' (v53) e salvam só o CAMINHO. A assinatura eletrônica de
--  contrato (v61) ficou pra trás: gravava a imagem inteira em base64 na
--  coluna selfie_b64. Dado biométrico não deve morar no banco — pesa nas
--  queries, entra em qualquer dump/backup e não tem como expirar acesso.
--
--  Agora selfie_path guarda o caminho no bucket e a URL é assinada sob
--  demanda no render do certificado (onde já há auth de dono/token).
--
--  selfie_b64 CONTINUA existindo como fallback: contratos já assinados
--  têm a imagem só lá, e o certificado deles precisa seguir renderizando.
--  Assinaturas novas gravam só selfie_path.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_assinatura_signatarios
  ADD COLUMN IF NOT EXISTS selfie_path TEXT;

COMMENT ON COLUMN contrato_assinatura_signatarios.selfie_path IS
  'Caminho da selfie no bucket privado ''selfies''. A URL é assinada no servidor na hora de renderizar o certificado.';

COMMENT ON COLUMN contrato_assinatura_signatarios.selfie_b64 IS
  'LEGADO (até v82): selfie em base64. Mantida só pra renderizar certificados de contratos assinados antes da migração pro bucket privado. Assinaturas novas usam selfie_path.';

NOTIFY pgrst, 'reload schema';
