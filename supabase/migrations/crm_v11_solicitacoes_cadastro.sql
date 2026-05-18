-- ════════════════════════════════════════════════════════════════════
--  CRM v11 — Solicitação de atualização de cadastro (magic link)
--  O dono gera um link com validade de 24h pra que a pessoa
--  (inquilino/proprietário/fiador) preencha campos e suba documentos
--  selecionados. Sem login do convidado — o token é a credencial.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS solicitacoes_cadastro (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pessoa_id       UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  campos          JSONB NOT NULL DEFAULT '[]'::jsonb,      -- ["nome","email","telefone",...]
  tipos_documento JSONB NOT NULL DEFAULT '[]'::jsonb,      -- ["rg","cpf","comprovante_residencia",...]
  expira_em       TIMESTAMPTZ NOT NULL,
  preenchido_em   TIMESTAMPTZ,
  preenchido_ip   TEXT,
  revogado_em     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solicitacoes_cadastro_token_idx
  ON solicitacoes_cadastro (token);
CREATE INDEX IF NOT EXISTS solicitacoes_cadastro_pessoa_idx
  ON solicitacoes_cadastro (pessoa_id);
CREATE INDEX IF NOT EXISTS solicitacoes_cadastro_ativas_idx
  ON solicitacoes_cadastro (user_id, expira_em DESC)
  WHERE preenchido_em IS NULL AND revogado_em IS NULL;

ALTER TABLE solicitacoes_cadastro ENABLE ROW LEVEL SECURITY;

-- O dono (anunciante) gerencia suas solicitações; o convidado acessa
-- via admin client na rota pública /atualizar-cadastro, sem passar por RLS.
DROP POLICY IF EXISTS solicitacoes_dono ON solicitacoes_cadastro;
CREATE POLICY solicitacoes_dono ON solicitacoes_cadastro
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
