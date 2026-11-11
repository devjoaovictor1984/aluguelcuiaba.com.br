-- ════════════════════════════════════════════════════════════════════
--  CRM v105 — Biblioteca de cláusulas: código, versão e histórico
--
--  Até aqui a cláusula da biblioteca era só título + corpo. Editar
--  sobrescrevia o texto anterior sem volta, e o contrato reconhecia cada
--  variante (pet, mobília, atuação…) comparando trechos do TÍTULO — bastava
--  renomear "Pet — aceita" pra regra parar de achar a cláusula, em silêncio.
--
--  1) contrato_clausulas ganha:
--       codigo        — identificador estável da cláusula do modelo
--                       (ex.: 'administracao.da-remuneracao'). Nulo = cláusula
--                       criada pelo próprio usuário. A seleção automática
--                       passa a usar o código, não o título.
--       versao        — sobe a cada edição de título/corpo (gatilho abaixo).
--       modelo_versao — de qual versão do modelo a cláusula veio. Quando o
--                       modelo publica versão nova, a biblioteca avisa e
--                       mostra a diferença; nada é trocado sozinho.
--
--  2) contrato_clausulas_historico guarda a versão anterior a cada edição e
--     a cláusula inteira quando ela é excluída (inclusive pelo "reimportar
--     modelo"), pra poder comparar e restaurar.
--
--  3) contratos_administracao ganha os campos que o modelo deixava em
--     colchetes pra preencher à mão:
--       taxa_base          — sobre o que a taxa percentual incide
--       repasse_dias_uteis — prazo do repasse após o recebimento
--       limite_reparos     — teto por evento para reparo urgente sem
--                            autorização prévia
--
--  Só acrescenta. Contratos e gerações existentes não mudam: cada geração
--  guarda a própria cópia das cláusulas.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Código e versão na biblioteca ──────────────────────────────────
ALTER TABLE contrato_clausulas
  ADD COLUMN IF NOT EXISTS codigo        TEXT,
  ADD COLUMN IF NOT EXISTS versao        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS modelo_versao INTEGER;

CREATE INDEX IF NOT EXISTS contrato_clausulas_user_codigo_idx
  ON contrato_clausulas (user_id, codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON COLUMN contrato_clausulas.codigo IS
  'Código estável da cláusula do modelo (src/lib/contratos/seed-modelo.ts). Nulo = criada pelo usuário.';
COMMENT ON COLUMN contrato_clausulas.versao IS
  'Versão desta cláusula na biblioteca do usuário; o gatilho soma 1 a cada edição de título/corpo.';
COMMENT ON COLUMN contrato_clausulas.modelo_versao IS
  'Versão do modelo em que esta cláusula se baseia. Menor que a do modelo atual = há atualização disponível.';

-- ─── 2. Histórico ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contrato_clausulas_historico (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clausula_id  UUID NOT NULL,          -- sem FK: a linha sobrevive à exclusão da cláusula
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo       TEXT,
  versao       INTEGER NOT NULL,
  tipo         TEXT NOT NULL,
  categoria    TEXT NOT NULL,
  titulo       TEXT NOT NULL,
  corpo        TEXT NOT NULL,
  ativa        BOOLEAN NOT NULL,
  evento       TEXT NOT NULL CHECK (evento IN ('edicao', 'exclusao')),
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contrato_clausulas_historico_clausula_idx
  ON contrato_clausulas_historico (clausula_id, versao DESC);
CREATE INDEX IF NOT EXISTS contrato_clausulas_historico_user_idx
  ON contrato_clausulas_historico (user_id, registrado_em DESC);

ALTER TABLE contrato_clausulas_historico ENABLE ROW LEVEL SECURITY;

-- Só leitura pelo dono. Quem escreve é o gatilho (SECURITY DEFINER).
DROP POLICY IF EXISTS contrato_clausulas_historico_owner_select ON contrato_clausulas_historico;
CREATE POLICY contrato_clausulas_historico_owner_select ON contrato_clausulas_historico
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION contrato_clausulas_registrar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Só conta como versão nova quando muda o texto (título/corpo).
    -- Ativar/desativar, renumerar ou vincular código não gera versão.
    IF NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.corpo IS DISTINCT FROM OLD.corpo THEN
      INSERT INTO contrato_clausulas_historico
        (clausula_id, user_id, codigo, versao, tipo, categoria, titulo, corpo, ativa, evento)
      VALUES
        (OLD.id, OLD.user_id, OLD.codigo, OLD.versao, OLD.tipo, OLD.categoria, OLD.titulo, OLD.corpo, OLD.ativa, 'edicao');
      NEW.versao := OLD.versao + 1;
      NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO contrato_clausulas_historico
      (clausula_id, user_id, codigo, versao, tipo, categoria, titulo, corpo, ativa, evento)
    VALUES
      (OLD.id, OLD.user_id, OLD.codigo, OLD.versao, OLD.tipo, OLD.categoria, OLD.titulo, OLD.corpo, OLD.ativa, 'exclusao');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contrato_clausulas_historico_upd ON contrato_clausulas;
CREATE TRIGGER contrato_clausulas_historico_upd
  BEFORE UPDATE ON contrato_clausulas
  FOR EACH ROW EXECUTE FUNCTION contrato_clausulas_registrar_historico();

DROP TRIGGER IF EXISTS contrato_clausulas_historico_del ON contrato_clausulas;
CREATE TRIGGER contrato_clausulas_historico_del
  BEFORE DELETE ON contrato_clausulas
  FOR EACH ROW EXECUTE FUNCTION contrato_clausulas_registrar_historico();

-- ─── 3. Campos do contrato de administração ───────────────────────────
ALTER TABLE contratos_administracao
  ADD COLUMN IF NOT EXISTS taxa_base          TEXT NOT NULL DEFAULT 'aluguel',
  ADD COLUMN IF NOT EXISTS repasse_dias_uteis SMALLINT,
  ADD COLUMN IF NOT EXISTS limite_reparos     NUMERIC(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contratos_administracao_taxa_base_check'
  ) THEN
    ALTER TABLE contratos_administracao
      ADD CONSTRAINT contratos_administracao_taxa_base_check
      CHECK (taxa_base IN ('aluguel', 'aluguel_encargos'));
  END IF;
END $$;

COMMENT ON COLUMN contratos_administracao.taxa_base IS
  'Base da taxa percentual: "aluguel" (só o aluguel-base) ou "aluguel_encargos" (aluguel + condomínio + IPTU efetivamente recebidos). Seguros e consumos nunca entram.';
COMMENT ON COLUMN contratos_administracao.repasse_dias_uteis IS
  'Prazo máximo, em dias úteis após a compensação do pagamento do locatário, para o repasse à proprietária.';
COMMENT ON COLUMN contratos_administracao.limite_reparos IS
  'Teto por evento (R$) para reparo urgente sem autorização prévia da proprietária.';

NOTIFY pgrst, 'reload schema';
