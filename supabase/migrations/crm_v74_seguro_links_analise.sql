-- ════════════════════════════════════════════════════════════════════
--  CRM v74 — Link de análise de fiança (preenchimento pelo inquilino)
--
--  O painel da Maximiza tem "Gera Link de Análise", mas a API NÃO expõe
--  isso: os 13 endpoints documentados vão de transmitirAnalise a
--  contratar, e nenhum gera link. Então o link é NOSSO.
--
--  Melhor assim: o inquilino vê a marca do corretor, e o cadastro nasce
--  em `pessoas` — o lead fica no CRM em vez de só no painel da corretora.
--
--  Mesmo padrão de magic link já usado em solicitacoes_cadastro (v11),
--  contrato_revisao_links (v57) e termos_entrega_chaves (v51): token é a
--  credencial, sem login, com validade.
--
--  Divisão do formulário:
--    · corretor  → imóvel, aluguel, encargos, prazo (informação dele)
--    · inquilino → nome, CPF, contato, nascimento (informação dele)
--
--  Fluxo:
--    rascunho → enviado → (inquilino preenche) → analise_id preenchido
--                      ↘ expirado / revogado
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seguro_analise_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto         TEXT NOT NULL DEFAULT 'fianca' CHECK (produto IN ('fianca','incendio')),

  token           TEXT NOT NULL UNIQUE,

  -- Contexto do CRM. Tudo opcional: dá pra mandar link pra quem ainda não
  -- tem cadastro nem imóvel definido.
  imovel_id       UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  contrato_id     UUID REFERENCES contratos_locacao(id) ON DELETE SET NULL,
  pessoa_id       UUID REFERENCES pessoas(id) ON DELETE SET NULL,

  -- Preenchido pelo corretor antes de enviar: cep, aluguel, condominio,
  -- iptu, finalidade, tipo, periodoContratoMeses, pinturaNova.
  dados_imovel    JSONB NOT NULL DEFAULT '{}'::jsonb,
  seguradoras     TEXT[],                       -- vazio = todas disponíveis
  tipo_analise    TEXT NOT NULL DEFAULT 'reduzida'
                    CHECK (tipo_analise IN ('reduzida','completa')),

  -- Rótulo pra o inquilino saber do que se trata.
  titulo          TEXT,
  mensagem        TEXT,

  -- Ciclo de vida
  expira_em       TIMESTAMPTZ NOT NULL,
  aberto_em       TIMESTAMPTZ,                  -- 1ª visualização
  preenchido_em   TIMESTAMPTZ,
  preenchido_ip   TEXT,
  revogado_em     TIMESTAMPTZ,

  -- Vira análise quando o inquilino conclui.
  analise_id      UUID REFERENCES seguro_analises(id) ON DELETE SET NULL,
  erro            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seguro_links_user_idx
  ON seguro_analise_links (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seguro_links_token_idx
  ON seguro_analise_links (token);
CREATE INDEX IF NOT EXISTS seguro_links_pendentes_idx
  ON seguro_analise_links (user_id, expira_em DESC)
  WHERE preenchido_em IS NULL AND revogado_em IS NULL;

COMMENT ON TABLE seguro_analise_links IS
  'Magic link pro pretenso inquilino preencher a própria análise. Implementação nossa: a API da corretora não expõe geração de link.';
COMMENT ON COLUMN seguro_analise_links.dados_imovel IS
  'Parte do formulário que é do corretor (imóvel, aluguel, encargos). O inquilino só completa os dados pessoais dele.';

ALTER TABLE seguro_analise_links ENABLE ROW LEVEL SECURITY;

-- O convidado acessa pela rota pública com service-role, sem passar por RLS.
DROP POLICY IF EXISTS seguro_links_dono ON seguro_analise_links;
CREATE POLICY seguro_links_dono ON seguro_analise_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ── Origem da análise ─────────────────────────────────────────────────
-- Distingue quem digitou: o corretor no painel ou o inquilino pelo link.
-- Serve pro corretor saber de onde veio e, mais à frente, pra medir qual
-- caminho converte melhor.
ALTER TABLE seguro_analises
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'painel'
    CHECK (origem IN ('painel','link'));

COMMENT ON COLUMN seguro_analises.origem IS
  'painel = corretor preencheu · link = o próprio inquilino preencheu pelo magic link.';


DROP TRIGGER IF EXISTS trg_seguro_links_touch ON seguro_analise_links;
CREATE TRIGGER trg_seguro_links_touch BEFORE UPDATE ON seguro_analise_links
  FOR EACH ROW EXECUTE FUNCTION seguros_touch_updated_at();

NOTIFY pgrst, 'reload schema';
