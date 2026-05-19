-- ════════════════════════════════════════════════════════════════════
--  CRM v18 — Log de envios (email + push)
--  Cada email/push enviado fica registrado aqui pra auditoria e pra
--  alimentar o painel de quotas no admin. Permite ver quanto está
--  sendo gasto por canal/mês e disparar alerta antes de bater o limite.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS envios_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('email','push')),
  canal         TEXT,                                     -- chave do template ou 'broadcast'
  destinatario  TEXT,                                     -- email, endpoint truncado ou user_id
  status        TEXT NOT NULL CHECK (status IN ('ok','erro','morta')),
  erro_msg      TEXT,
  contexto      JSONB,                                    -- assunto, payload title, etc
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice principal: queries sempre filtram por created_at (mês atual, último 24h).
CREATE INDEX IF NOT EXISTS envios_log_created_idx
  ON envios_log (created_at DESC);

-- Pra dashboards agregados por tipo
CREATE INDEX IF NOT EXISTS envios_log_tipo_created_idx
  ON envios_log (tipo, created_at DESC);

-- Erros recentes (auditoria)
CREATE INDEX IF NOT EXISTS envios_log_erro_idx
  ON envios_log (created_at DESC)
  WHERE status = 'erro';

ALTER TABLE envios_log ENABLE ROW LEVEL SECURITY;

-- Só admin lê via admin client. Sem policies pra authenticated/anon.

-- Quotas mensais (soft) ficam em site_config:
INSERT INTO site_config (chave, valor) VALUES
  ('quota_email_mensal', '1000'),
  ('quota_push_mensal',  '100000')
ON CONFLICT (chave) DO NOTHING;

NOTIFY pgrst, 'reload schema';
