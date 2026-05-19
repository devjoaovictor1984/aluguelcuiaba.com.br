-- ════════════════════════════════════════════════════════════════════
--  CRM v14 — Push notifications (Web Push, VAPID)
--  Visitantes (logados ou anônimos) podem ativar "avisar de novos
--  imóveis". Cada subscrição é um endpoint único do navegador (FCM no
--  Chrome/Android, Mozilla Push no Firefox, Apple Push no iOS-PWA).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,   -- chave pública do client (encriptação)
  auth        TEXT NOT NULL,   -- secret do client (auth)
  user_agent  TEXT,            -- pra debug
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anônimos NÃO precisam ver a tabela. Toda escrita/leitura usa o admin
-- client nas API routes — RLS bloqueia clientes diretos por padrão.

NOTIFY pgrst, 'reload schema';
