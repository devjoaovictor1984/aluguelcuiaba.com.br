-- ════════════════════════════════════════════════════════════════════
--  CRM v57 — Link de revisão de contrato (cliente faz considerações)
--
--  O corretor gera um link por token. O cliente abre sem login, vê o PDF
--  do contrato (locação ou administração) e envia considerações por texto.
--  As considerações ficam visíveis pro corretor no editor de geração.
--
--  contrato_id guarda a CHAVE do PDF:
--    - locação       → id da geração (contrato_geracoes)
--    - administração → id do contrato de administração (contratos_administracao)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrato_revisao_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('locacao','administracao')),
  contrato_id   UUID NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  titulo        TEXT,
  expira_em     TIMESTAMPTZ NOT NULL,
  revogado_em   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisao_links_user ON contrato_revisao_links(user_id);
CREATE INDEX IF NOT EXISTS idx_revisao_links_contrato ON contrato_revisao_links(tipo_contrato, contrato_id);

CREATE TABLE IF NOT EXISTS contrato_revisao_consideracoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     UUID NOT NULL REFERENCES contrato_revisao_links(id) ON DELETE CASCADE,
  autor_nome  TEXT,
  texto       TEXT NOT NULL,
  ip          TEXT,
  lido_em     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisao_consid_link ON contrato_revisao_consideracoes(link_id);

ALTER TABLE contrato_revisao_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_revisao_consideracoes ENABLE ROW LEVEL SECURITY;

-- Dono gerencia seus próprios links. O acesso público (cliente) usa service role.
DROP POLICY IF EXISTS revisao_links_owner ON contrato_revisao_links;
CREATE POLICY revisao_links_owner ON contrato_revisao_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS revisao_consid_owner ON contrato_revisao_consideracoes;
CREATE POLICY revisao_consid_owner ON contrato_revisao_consideracoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contrato_revisao_links l WHERE l.id = link_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contrato_revisao_links l WHERE l.id = link_id AND l.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
