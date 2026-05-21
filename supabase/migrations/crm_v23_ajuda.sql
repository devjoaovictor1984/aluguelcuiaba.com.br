-- ════════════════════════════════════════════════════════════════════
--  CRM v23 — Sistema de ajuda
--
--  Tabela com seções de ajuda renderizadas como HTML (Tiptap).
--  Escrita só por admin (perfis.role = 'admin').
--  Leitura por todo authenticated (qualquer usuário do CRM acessa).
--  Componente <BotaoAjuda slug="..."/> carrega a seção pelo slug.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ajuda_secoes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  titulo        TEXT NOT NULL,
  resumo        TEXT,                  -- 1 linha mostrada em listas
  icone         TEXT,                  -- nome do ícone lucide (opcional)
  conteudo_html TEXT NOT NULL DEFAULT '',
  ordem         INTEGER NOT NULL DEFAULT 100,
  publicado     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ajuda_secoes_ordem_idx ON ajuda_secoes (ordem);

ALTER TABLE ajuda_secoes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer authenticated lê seções publicadas; admin lê tudo
DROP POLICY IF EXISTS ajuda_select ON ajuda_secoes;
CREATE POLICY ajuda_select ON ajuda_secoes
  FOR SELECT TO authenticated
  USING (
    publicado = TRUE
    OR EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

-- Escrita: só admin
DROP POLICY IF EXISTS ajuda_insert ON ajuda_secoes;
CREATE POLICY ajuda_insert ON ajuda_secoes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS ajuda_update ON ajuda_secoes;
CREATE POLICY ajuda_update ON ajuda_secoes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS ajuda_delete ON ajuda_secoes;
CREATE POLICY ajuda_delete ON ajuda_secoes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'));

-- Atualiza atualizado_em a cada UPDATE
CREATE OR REPLACE FUNCTION ajuda_secoes_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ajuda_secoes_touch ON ajuda_secoes;
CREATE TRIGGER trg_ajuda_secoes_touch
  BEFORE UPDATE ON ajuda_secoes
  FOR EACH ROW
  EXECUTE FUNCTION ajuda_secoes_touch();

-- Seed inicial — 6 seções vazias (admin preenche pelo editor)
INSERT INTO ajuda_secoes (slug, titulo, resumo, icone, ordem, conteudo_html) VALUES
  ('inicio',     'Visão geral do CRM',  'Como o painel funciona e por onde começar',   'LayoutDashboard', 10, '<p>Em breve.</p>'),
  ('clientes',   'Clientes',            'Cadastrar inquilinos, proprietários e fiadores','Users',          20, '<p>Em breve.</p>'),
  ('contratos',  'Contratos de locação','Criar contrato, regerar parcelas, encerrar',  'FileText',       30, '<p>Em breve.</p>'),
  ('cobrancas',  'Cobranças',           'Enviar lembretes por WhatsApp e e-mail',      'Bell',           40, '<p>Em breve.</p>'),
  ('reajuste',   'Reajuste de aluguel', 'Aplicar IGP-M, IPCA ou manual',               'TrendingUp',     50, '<p>Em breve.</p>'),
  ('vistorias',  'Vistorias online',    'Entrada e saída com fotos e assinatura digital','ClipboardCheck', 60, '<p>Em breve.</p>')
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
