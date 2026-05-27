-- ════════════════════════════════════════════════════════════════════
--  CRM v39 — Sugestões de melhoria do sistema (feedback do usuário)
--
--  Botão flutuante no painel permite o usuário sugerir melhoria/reportar
--  bug em qualquer página. Admin tem menu pra triar e responder.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sugestoes_usuario (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contexto auto-capturado pelo client
  pagina_url   TEXT,                        -- ex: '/painel/contratos/abc-123/gerar'
  pagina_titulo TEXT,                       -- ex: 'Editor de geração — Contrato 2026CT017'
  user_agent   TEXT,                        -- navegador/SO

  -- Conteúdo do usuário
  categoria    TEXT NOT NULL DEFAULT 'sugestao'
               CHECK (categoria IN ('bug','sugestao','duvida','outro')),
  mensagem     TEXT NOT NULL CHECK (length(trim(mensagem)) > 0),

  -- Triagem pelo admin
  status       TEXT NOT NULL DEFAULT 'nova'
               CHECK (status IN ('nova','em_analise','implementada','descartada')),
  resposta_admin TEXT,
  respondido_em  TIMESTAMPTZ,
  respondido_por UUID REFERENCES auth.users(id),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sugestoes_user ON sugestoes_usuario(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sugestoes_status ON sugestoes_usuario(status, created_at DESC);

-- Touch updated_at
CREATE OR REPLACE FUNCTION touch_sugestao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sugestoes_touch ON sugestoes_usuario;
CREATE TRIGGER sugestoes_touch
  BEFORE UPDATE ON sugestoes_usuario
  FOR EACH ROW
  EXECUTE FUNCTION touch_sugestao_updated_at();

-- RLS: usuário só vê e cria as suas; admin vê tudo via service_role na API
ALTER TABLE sugestoes_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sugestoes_select_own ON sugestoes_usuario;
CREATE POLICY sugestoes_select_own ON sugestoes_usuario
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sugestoes_insert_own ON sugestoes_usuario;
CREATE POLICY sugestoes_insert_own ON sugestoes_usuario
  FOR INSERT WITH CHECK (auth.uid() = user_id);
