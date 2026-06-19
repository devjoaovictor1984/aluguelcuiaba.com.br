-- ════════════════════════════════════════════════════════════════════
--  CRM v61 — Assinatura eletrônica na plataforma (Fase 1)
--
--  Processo de assinatura por contrato (locação ou administração). Cada
--  signatário recebe um link por token, confirma OTP por e-mail, tira
--  selfie, desenha a assinatura e dá consentimento. Tudo com trilha de
--  auditoria (IP, user-agent, geo, timestamps).
--
--  contrato_id = chave do PDF: geração (locação) ou contrato (administração).
--  Selfie e assinatura ficam em base64 (TEXT) no MVP — migrar p/ bucket depois.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrato_assinaturas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('locacao','administracao')),
  contrato_id   UUID NOT NULL,
  titulo        TEXT,
  status        TEXT NOT NULL DEFAULT 'enviado'
                CHECK (status IN ('enviado','concluido','cancelado')),
  pdf_hash      TEXT,                 -- SHA-256 do PDF do contrato (preenchido na conclusão)
  pdf_final_path TEXT,                -- PDF assinado final (Fase 2)
  concluido_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_user ON contrato_assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_contrato ON contrato_assinaturas(tipo_contrato, contrato_id);

CREATE TABLE IF NOT EXISTS contrato_assinatura_signatarios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id      UUID NOT NULL REFERENCES contrato_assinaturas(id) ON DELETE CASCADE,
  nome               TEXT NOT NULL,
  email              TEXT NOT NULL,
  papel              TEXT,
  token              TEXT NOT NULL UNIQUE,
  ordem              INTEGER NOT NULL DEFAULT 0,

  -- OTP por e-mail
  otp_hash           TEXT,
  otp_expira_em      TIMESTAMPTZ,
  otp_verificado_em  TIMESTAMPTZ,

  -- Assinatura
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','assinado')),
  selfie_b64         TEXT,
  assinatura_b64     TEXT,
  consentimento_em   TIMESTAMPTZ,
  assinado_em        TIMESTAMPTZ,

  -- Trilha de auditoria
  ip                 TEXT,
  user_agent         TEXT,
  geo                TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assinatura_signatarios ON contrato_assinatura_signatarios(assinatura_id);

ALTER TABLE contrato_assinaturas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_assinatura_signatarios   ENABLE ROW LEVEL SECURITY;

-- Dono gerencia seus processos. O acesso público (signatário) usa service role.
DROP POLICY IF EXISTS assinaturas_owner ON contrato_assinaturas;
CREATE POLICY assinaturas_owner ON contrato_assinaturas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS assinatura_signatarios_owner ON contrato_assinatura_signatarios;
CREATE POLICY assinatura_signatarios_owner ON contrato_assinatura_signatarios
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contrato_assinaturas a WHERE a.id = assinatura_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contrato_assinaturas a WHERE a.id = assinatura_id AND a.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
