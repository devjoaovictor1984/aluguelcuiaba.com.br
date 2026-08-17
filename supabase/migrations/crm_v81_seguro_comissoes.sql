-- ════════════════════════════════════════════════════════════════════
--  CRM v81 — Comissão de seguro (fiança e incêndio)
--
--  Por que uma tabela, e não uma coluna nas existentes:
--
--  A comissão de ALUGUEL não precisa de registro próprio. O dinheiro
--  passa pela mão do corretor — ele recebe, retém a taxa e repassa o
--  resto ao proprietário. Se a parcela foi paga, a comissão foi ganha;
--  não há o que conciliar, e por isso /painel/financeiro/comissoes lê
--  direto das parcelas.
--
--  A de SEGURO é outra coisa. O dinheiro vem de terceiro, semanas ou
--  meses depois da emissão, pode vir diferente do previsto e pode ser
--  estornado se o cliente cancelar. Previsto ≠ recebido, e a diferença
--  entre os dois é justamente o que precisa ficar visível. Isso exige
--  estado, e estado precisa de linha própria.
--
--  DUAS COMISSÕES, INDEPENDENTES (decisão de 17/08/2026):
--   · o corretor recebe a dele direto da corretora;
--   · a plataforma recebe um override sobre o que foi originado aqui.
--  Uma não passa pela outra — a plataforma nunca deve ao corretor. Por
--  isso são dois valores e DOIS ESTADOS na mesma linha: o corretor pode
--  ter recebido enquanto o override ainda não caiu, e vice-versa.
--
--  ⚠️ OS PERCENTUAIS AINDA NÃO EXISTEM. A tabela de comissionamento da
--  Maximiza é o item 2.5 do documento de pendências e segue em aberto —
--  percentual, base de cálculo, prazo e regra de estorno. Os 20% que a
--  plataforma exibe hoje foram lidos da coluna "Pró-labore" do painel
--  deles: é referência, não acordo. Guardar o FATO da venda, porém, não
--  depende de acordo nenhum, e é o que se perde se não for feito agora.
--
--  Por isso o percentual é gravado NA LINHA, e não lido de configuração
--  na hora de exibir: quando a tabela mudar, venda antiga mantém a taxa
--  do dia em que aconteceu. Sem isso o histórico se reescreve sozinho e
--  nenhuma conferência fecha.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seguro_comissoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem vendeu. Corretor, imobiliária ou proprietário que opera na
  -- plataforma — o recorte "vejo as minhas" sai daqui, pela RLS.
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  produto               TEXT NOT NULL CHECK (produto IN ('fianca','incendio')),

  -- A origem. Exatamente uma das duas, garantido pelo CHECK no fim.
  contratacao_id        UUID REFERENCES seguro_contratacoes(id) ON DELETE CASCADE,
  apolice_incendio_id   UUID REFERENCES seguro_incendio_apolices(id) ON DELETE CASCADE,

  -- Contexto de negócio: é o que permite ver "quanto este cliente já
  -- rendeu" somando com a comissão de aluguel, que aponta pra cá também.
  pessoa_id             UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  contrato_id           UUID REFERENCES contratos_locacao(id) ON DELETE SET NULL,

  seguradora_sigla      TEXT,
  apolice_numero        TEXT,

  -- Base de cálculo, congelada no momento da venda.
  premio_total          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Primeiro dia do mês da venda. É por ela que o extrato agrupa, e não
  -- por created_at: um acerto lançado em outubro sobre venda de agosto
  -- pertence a agosto.
  competencia           DATE NOT NULL,

  /* ── Comissão do corretor ──────────────────────────────────────── */
  percentual_corretor       NUMERIC(6,4),
  valor_corretor            NUMERIC(12,2),
  status_corretor           TEXT NOT NULL DEFAULT 'prevista'
                              CHECK (status_corretor IN ('prevista','confirmada','recebida','estornada','cancelada')),
  recebido_corretor_em      DATE,
  valor_recebido_corretor   NUMERIC(12,2),

  /* ── Override da plataforma ────────────────────────────────────── */
  percentual_plataforma     NUMERIC(6,4),
  valor_plataforma          NUMERIC(12,2),
  status_plataforma         TEXT NOT NULL DEFAULT 'prevista'
                              CHECK (status_plataforma IN ('prevista','confirmada','recebida','estornada','cancelada')),
  recebido_plataforma_em    DATE,
  valor_recebido_plataforma NUMERIC(12,2),

  observacao            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uma origem, e só uma.
  CONSTRAINT origem_unica CHECK (
    (contratacao_id IS NOT NULL AND apolice_incendio_id IS NULL) OR
    (contratacao_id IS NULL AND apolice_incendio_id IS NOT NULL)
  )
);

-- Uma comissão por venda. O índice é parcial porque cada linha preenche
-- só uma das duas origens.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comissao_contratacao
  ON seguro_comissoes(contratacao_id) WHERE contratacao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comissao_apolice_incendio
  ON seguro_comissoes(apolice_incendio_id) WHERE apolice_incendio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comissao_user_competencia
  ON seguro_comissoes(user_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_comissao_pessoa
  ON seguro_comissoes(pessoa_id) WHERE pessoa_id IS NOT NULL;
-- O que o admin abre primeiro: o que ainda não caiu.
CREATE INDEX IF NOT EXISTS idx_comissao_plataforma_pendente
  ON seguro_comissoes(competencia DESC)
  WHERE status_plataforma IN ('prevista','confirmada');


ALTER TABLE seguro_comissoes ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão das demais tabelas de seguros (v77): o dono enxerga as
-- suas. O admin lê pelo cliente de serviço, que ignora RLS.
DROP POLICY IF EXISTS seguro_comissoes_dono ON seguro_comissoes;
CREATE POLICY seguro_comissoes_dono ON seguro_comissoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


COMMENT ON TABLE seguro_comissoes IS
  'Uma linha por seguro vendido. Dois valores e dois estados: a comissão do corretor (paga pela corretora a ele) e o override da plataforma. Percentuais congelados na venda.';
COMMENT ON COLUMN seguro_comissoes.competencia IS
  'Mês a que a venda pertence. O extrato agrupa por aqui, não por created_at.';
