-- ════════════════════════════════════════════════════════════════════
--  CRM v107 — Publicação nos portais (OLX · ZAP Imóveis · Viva Real)
--
--  Os três são do Grupo OLX e recebem anúncios do mesmo jeito: o
--  anunciante tem conta no Canal Pro e cadastra lá UMA URL de feed XML no
--  padrão VRSync. O portal lê essa URL algumas vezes por dia e publica o
--  que estiver nela. Ver docs/integracoes/portais/README.md.
--
--  imoveis
--   · publicar_portais      o anunciante escolhe, anúncio a anúncio, o que
--                           vai pro feed. Default false: nada sai do site
--                           sem alguém ligar.
--   · portais_destaque      tipo de publicação no portal (STANDARD,
--                           PREMIUM, ...). Tem que bater com o plano
--                           contratado no Canal Pro — o portal recusa
--                           destaque que o contrato não cobre.
--
--  portais_feed (tabela nova, uma linha por anunciante)
--   · token                 segredo da URL do feed. Quem tem a URL lê o
--                           feed (é assim que o Canal Pro funciona: sem
--                           login). Trocar o token derruba a URL antiga.
--   · NÃO fica em `perfis`: perfis é lido pelo cliente anônimo (página
--     pública do anunciante) e o RLS é por linha, não por coluna — o token
--     vazaria pra qualquer um com a anon key. Aqui o RLS fica ligado SEM
--     política: só o service role (servidor) lê e escreve.
--
--  Retrocompatível: nada muda até alguém ligar um anúncio.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS publicar_portais BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portais_destaque TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK (portais_destaque IN ('STANDARD', 'PREMIUM', 'SUPER_PREMIUM'));

CREATE TABLE IF NOT EXISTS portais_feed (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Última leitura do feed (quem leu: o portal). Ajuda a responder
  -- "o Canal Pro já está puxando?" sem abrir o painel deles.
  lido_em        TIMESTAMPTZ,
  lido_por       TEXT
);

ALTER TABLE portais_feed ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY de propósito: anon e authenticated não enxergam nada.

-- O feed filtra por dono + flag; índice parcial fica minúsculo.
CREATE INDEX IF NOT EXISTS imoveis_publicar_portais_idx
  ON imoveis (user_id)
  WHERE publicar_portais;

NOTIFY pgrst, 'reload schema';
