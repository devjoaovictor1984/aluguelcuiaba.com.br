-- ════════════════════════════════════════════════════════════════════
--  CRM v80 — Sessões de homologação (equipe técnica da corretora)
--
--  Por que existe: hoje a Maximiza responde sobre a integração sem nunca
--  ter visto o produto. Três perguntas estão travadas há dias porque são
--  difíceis de explicar por escrito — link de biometria, habilitação por
--  seguradora, formas de pagamento vazias. Se o time técnico deles cotar
--  aqui dentro, viram conversa de tela.
--
--  O que este link NÃO é: acesso de admin. Admin no AluguelCuiabá enxerga
--  contrato, inquilino e CPF de TODOS os corretores, apaga registro e
--  mexe em configuração. Entregar isso a terceiro é problema de LGPD,
--  não de conveniência — e se algo sumir no meio do teste, não há como
--  distinguir erro deles de erro nosso.
--
--  O desenho, então:
--
--   1. a sessão entra como um usuário PRÓPRIO (role 'homologacao'), não
--      como o dono da conta. Como toda listagem do módulo filtra por
--      user_id, o isolamento vem de graça: eles veem só o que eles
--      mesmos criaram, e nunca um CPF de cliente real;
--   2. a role 'homologacao' passa em `exigirAcessoSeguros` e em mais
--      nada. `exigirAcessoCRM` continua barrando (plano free, sem
--      crm_ativo), e todo /admin exige role = 'admin';
--   3. o token é a credencial, com validade e revogação — mesmo padrão
--      de seguro_analise_links (v74) e contrato_revisao_links (v57);
--   4. ambiente 2 continua sendo decidido por variável de ambiente, e
--      não pela sessão: convidado nenhum emite apólice de verdade.
--
--  O apontamento é a razão de ser disso tudo. "Aqui está errado" sem
--  contexto não ajuda uma semana depois; por isso `contexto` e `eventos`
--  são preenchidos pelo servidor, não digitados por quem anota.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sessoes_homologacao (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem abriu a sessão (admin da plataforma).
  criado_por        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- O usuário de baixo privilégio que a sessão encarna. Criado sob
  -- demanda e reaproveitado entre sessões — o isolamento que interessa é
  -- em relação aos dados reais, não entre convidados.
  usuario_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  token             TEXT NOT NULL UNIQUE,

  -- Para quem foi aberta. Aparece na tela de entrada e no log.
  nome              TEXT NOT NULL,
  organizacao       TEXT,
  observacao        TEXT,

  expira_em         TIMESTAMPTZ NOT NULL,
  revogada_em       TIMESTAMPTZ,

  -- Sinais de uso, para saber se vale cobrar retorno.
  primeiro_acesso_em TIMESTAMPTZ,
  ultimo_acesso_em  TIMESTAMPTZ,
  acessos           INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_homolog_token   ON sessoes_homologacao(token);
CREATE INDEX IF NOT EXISTS idx_sessoes_homolog_criador ON sessoes_homologacao(criado_por, created_at DESC);


CREATE TABLE IF NOT EXISTS homologacao_apontamentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id     UUID NOT NULL REFERENCES sessoes_homologacao(id) ON DELETE CASCADE,

  -- 'erro'     — está quebrado
  -- 'duvida'   — não entendi / está certo assim?
  -- 'sugestao' — funciona, mas podia ser diferente
  -- 'ok'       — confirmação de que o comportamento está correto
  --              (vale tanto quanto as outras: é o que fecha pergunta)
  tipo          TEXT NOT NULL CHECK (tipo IN ('erro','duvida','sugestao','ok')),

  titulo        TEXT NOT NULL,
  detalhe       TEXT,

  -- Preenchido pelo SERVIDOR: rota, produto, análise/apólice, seguradora.
  -- É o que transforma "aqui está errado" em algo acionável depois.
  contexto      JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Fotografia das últimas chamadas de integração daquele registro no
  -- momento do apontamento. Já sai sanitizada de seguro_eventos.
  eventos       JSONB,

  -- Tratamento do nosso lado.
  resolvido_em  TIMESTAMPTZ,
  resolucao     TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apontamentos_sessao ON homologacao_apontamentos(sessao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apontamentos_abertos
  ON homologacao_apontamentos(created_at DESC) WHERE resolvido_em IS NULL;


-- RLS ligada e sem policy: as duas tabelas são acessadas só pelo cliente
-- de serviço, que a ignora. Sem isso, a anon key alcançaria os tokens.
ALTER TABLE sessoes_homologacao      ENABLE ROW LEVEL SECURITY;
ALTER TABLE homologacao_apontamentos ENABLE ROW LEVEL SECURITY;


-- A role nova é só um valor de texto em perfis.role; não há CHECK a
-- alterar. Fica registrado aqui porque é o que dá acesso ao módulo:
--
--   role = 'admin'        → tudo
--   role = 'homologacao'  → só /painel/seguros, e só enquanto a sessão
--                           estiver válida (checado no layout)
COMMENT ON TABLE sessoes_homologacao IS
  'Link temporário para a equipe técnica da corretora cotar em homologação. Entra como usuário de role homologacao, nunca como admin.';
COMMENT ON TABLE homologacao_apontamentos IS
  'Anotações feitas durante a sessão, com contexto e eventos de integração capturados pelo servidor.';
