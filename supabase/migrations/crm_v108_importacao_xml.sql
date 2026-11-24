-- ════════════════════════════════════════════════════════════════════
--  CRM v108 — Importar anúncios de outro sistema (arquivo XML VRSync)
--
--  O caminho de volta da v107: quase todo sistema de imobiliária gera o
--  XML VRSync que o Canal Pro lê. Com a URL (ou o arquivo) desse XML, o
--  site traz os imóveis de aluguel para cá. Ver
--  docs/integracoes/importacao/README.md.
--
--  imoveis
--   · importacao_codigo     o ListingID/CodigoImovel do sistema de origem.
--                           Único por anunciante: reimportar ATUALIZA em
--                           vez de duplicar.
--   · importacao_fonte_id   de qual URL veio (NULL = arquivo enviado).
--   · importado_em          última vez que a importação gravou nele.
--   · importacao_dados      foto do que a importação gravou da última vez
--                           (campos + fotos). Na reimportação, campo que o
--                           anunciante mudou aqui NÃO é sobrescrito: só
--                           muda o que ainda está igual ao que veio.
--
--  importacoes_fontes      URLs salvas (para reimportar / sincronizar
--                           todo dia pelo cron).
--  importacoes             cada análise/importação (o "job").
--  importacoes_itens       um imóvel do arquivo por linha, com o dado já
--                           convertido; processado em lotes.
--  importacao_bairros      "Jd. Itália" do sistema deles = qual bairro
--                           daqui. Guardado por anunciante e reaproveitado.
--  importacao_descartados  imóvel importado que o anunciante APAGOU aqui:
--                           a próxima importação não traz de volta sozinha.
--
--  Bucket `importacoes` (privado): o XML enviado pelo navegador sobe
--  direto pra cá por URL assinada (a server action não aceita 50 MB).
--
--  RLS ligado SEM política em todas as tabelas novas: quem lê e escreve é
--  o servidor (service role), depois de conferir dono/admin na action.
--
--  Retrocompatível: nada muda até alguém importar. Idempotente.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS importacao_codigo   TEXT,
  ADD COLUMN IF NOT EXISTS importacao_fonte_id UUID,
  ADD COLUMN IF NOT EXISTS importado_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS importacao_dados    JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS imoveis_importacao_codigo_uq
  ON imoveis (user_id, importacao_codigo)
  WHERE importacao_codigo IS NOT NULL;

-- ── Fontes (URLs salvas) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS importacoes_fontes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                     TEXT,
  url                      TEXT NOT NULL,
  -- Sincronização diária (cron): reimporta sozinho com as opções abaixo.
  sincronizar              BOOLEAN NOT NULL DEFAULT FALSE,
  opcoes                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultima_importacao_id     UUID,
  ultima_sincronizacao_em  TIMESTAMPTZ,
  ultimo_erro              TEXT,
  criado_por               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url)
);

DO $$ BEGIN
  ALTER TABLE imoveis
    ADD CONSTRAINT imoveis_importacao_fonte_fk
    FOREIGN KEY (importacao_fonte_id) REFERENCES importacoes_fontes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Importações ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS importacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dono dos imóveis que vão nascer (o admin pode importar para alguém).
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fonte_id       UUID REFERENCES importacoes_fontes(id) ON DELETE SET NULL,
  origem         TEXT NOT NULL CHECK (origem IN ('url', 'arquivo')),
  url            TEXT,
  arquivo_path   TEXT,
  arquivo_nome   TEXT,
  formato        TEXT,                -- 'vrsync' | 'zap_legado'
  status         TEXT NOT NULL DEFAULT 'analisando'
                 CHECK (status IN ('analisando', 'pronta', 'importando', 'concluida', 'cancelada', 'erro')),
  erro           TEXT,
  automatica     BOOLEAN NOT NULL DEFAULT FALSE,
  opcoes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Contagens da análise (no arquivo, aluguel, venda, fora da cidade...)
  resumo         JSONB NOT NULL DEFAULT '{}'::jsonb,
  total          INT NOT NULL DEFAULT 0,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iniciado_em    TIMESTAMPTZ,
  concluido_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS importacoes_user_idx ON importacoes (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS importacoes_status_idx ON importacoes (status) WHERE status IN ('importando', 'analisando');

CREATE TABLE IF NOT EXISTS importacoes_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id   UUID NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
  ordem           INT NOT NULL DEFAULT 0,
  codigo          TEXT NOT NULL,
  titulo          TEXT,
  bairro_origem   TEXT,
  -- Imóvel já convertido para as colunas daqui + URLs das fotos de origem.
  dados           JSONB NOT NULL,
  -- 'criar' | 'atualizar' | 'ignorar' — o plano feito na análise.
  acao            TEXT NOT NULL CHECK (acao IN ('criar', 'atualizar', 'ignorar')),
  motivo          TEXT,               -- por que vai ser ignorado
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'processando', 'criado', 'atualizado', 'sem_mudanca', 'ignorado', 'erro')),
  problemas       JSONB NOT NULL DEFAULT '[]'::jsonb,
  mensagem        TEXT,
  imovel_id       UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  tentativas      INT NOT NULL DEFAULT 0,
  reservado_em    TIMESTAMPTZ,
  processado_em   TIMESTAMPTZ,
  UNIQUE (importacao_id, codigo)
);

CREATE INDEX IF NOT EXISTS importacoes_itens_fila_idx
  ON importacoes_itens (importacao_id, ordem)
  WHERE status IN ('pendente', 'processando');

-- ── Bairros de/para e descartados ───────────────────────────────────

CREATE TABLE IF NOT EXISTS importacao_bairros (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_origem  TEXT NOT NULL,          -- normalizado (sem acento, minúsculo)
  bairro_id    UUID NOT NULL REFERENCES bairros(id) ON DELETE CASCADE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, nome_origem)
);

CREATE TABLE IF NOT EXISTS importacao_descartados (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo       TEXT NOT NULL,
  descartado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, codigo)
);

ALTER TABLE importacoes_fontes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacao_bairros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacao_descartados ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY de propósito: só o service role enxerga.

-- ── Fila: reserva N itens sem que duas abas/execuções peguem o mesmo ──
-- SKIP LOCKED: duas chamadas ao mesmo tempo recebem itens diferentes.
-- Item preso em 'processando' há mais de 10 min (função que caiu no meio)
-- volta pra fila; depois de 3 tentativas vira erro, pra não travar tudo.

CREATE OR REPLACE FUNCTION importacao_reservar(p_importacao UUID, p_qtd INT)
RETURNS SETOF importacoes_itens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE importacoes_itens
     SET status = 'erro',
         mensagem = 'Falhou 3 vezes seguidas (tempo esgotado). Tente reimportar só este.',
         processado_em = NOW()
   WHERE importacao_id = p_importacao
     AND status = 'processando'
     AND reservado_em < NOW() - INTERVAL '10 minutes'
     AND tentativas >= 3;

  RETURN QUERY
  UPDATE importacoes_itens i
     SET status = 'processando',
         reservado_em = NOW(),
         tentativas = i.tentativas + 1
   WHERE i.id IN (
     SELECT id FROM importacoes_itens
      WHERE importacao_id = p_importacao
        AND (status = 'pendente'
             OR (status = 'processando' AND reservado_em < NOW() - INTERVAL '10 minutes'))
      ORDER BY ordem
      LIMIT GREATEST(1, LEAST(p_qtd, 50))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING i.*;
END;
$$;

REVOKE ALL ON FUNCTION importacao_reservar(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION importacao_reservar(UUID, INT) TO service_role;

-- ── Bucket privado do XML enviado ───────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'importacoes',
  'importacoes',
  FALSE,
  83886080, -- 80 MB
  NULL      -- XML chega como text/xml, application/xml, application/gzip ou octet-stream
)
ON CONFLICT (id) DO UPDATE
  SET public          = FALSE,
      file_size_limit = EXCLUDED.file_size_limit;

NOTIFY pgrst, 'reload schema';
