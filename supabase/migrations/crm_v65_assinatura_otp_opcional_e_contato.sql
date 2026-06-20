-- ════════════════════════════════════════════════════════════════════
--  CRM v65 — OTP opcional + contato (celular) do signatário
--
--  1) exigir_otp: o emitente decide, ao enviar pra assinatura, se exige
--     código por e-mail (OTP). Desmarcado = a pessoa assina só com selfie
--     + assinatura desenhada (sem código). O e-mail ainda é registrado e
--     recebe o contrato final quando todos assinarem.
--  2) celular: no momento de assinar, o signatário preenche e-mail e
--     celular pra validar a identidade (trilha de auditoria).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_assinaturas
  ADD COLUMN IF NOT EXISTS exigir_otp BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN contrato_assinaturas.exigir_otp IS
  'Se TRUE, cada signatário precisa confirmar um código (OTP) enviado por e-mail. Se FALSE, assina só com selfie + assinatura desenhada.';

ALTER TABLE contrato_assinatura_signatarios
  ADD COLUMN IF NOT EXISTS celular TEXT;

COMMENT ON COLUMN contrato_assinatura_signatarios.celular IS
  'Celular informado pelo signatário no momento da assinatura (identidade / contato).';

NOTIFY pgrst, 'reload schema';
