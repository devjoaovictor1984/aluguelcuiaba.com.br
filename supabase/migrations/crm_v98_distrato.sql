-- ─────────────────────────────────────────────────────────────────────
-- v98 · Distrato do contrato de locação
--
-- POR QUE: encerrar o contrato mudava só o status no sistema — baixava
-- as parcelas futuras, liberava o imóvel — e não gerava documento
-- nenhum. Mas a saída antes do prazo é justamente o momento em que as
-- partes precisam de papel: quem devolveu as chaves quando, se a multa
-- foi cobrada ou perdoada, quanto voltou da caução, e a quitação
-- recíproca que impede a cobrança de aparecer seis meses depois.
--
-- O desenho é o do termo aditivo (v49/v92/v95/v96): cláusula 1ª livre
-- (o objeto), demais cláusulas editáveis em JSONB com padrão no código,
-- testemunhas do cadastro, referência ao contrato originário, e
-- assinatura eletrônica pela plataforma. O que muda é o acerto de
-- contas, que aqui tem campos próprios: é o que as partes conferem.
--
-- UNIQUE (contrato_id): o contrato se dissolve uma vez. Errou, exclui e
-- refaz — diferente do aditivo, que é uma série (1º, 2º, 3º).
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contratos_distratos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id             UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  data_distrato           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Quando o imóvel volta às mãos do locador. Pode ser depois da
  -- assinatura (as partes combinam a saída) ou antes (já saiu, o
  -- documento só formaliza).
  data_desocupacao        DATE,

  -- Mesmos motivos de encerrarContrato() (actions.ts), pra não haver
  -- duas taxonomias falando da mesma saída.
  motivo                  TEXT NOT NULL DEFAULT 'acordo'
                          CHECK (motivo IN ('acordo','rescisao_inquilino','rescisao_proprietario',
                                            'inadimplencia','fim_natural','outro')),
  titulo                  TEXT,
  objeto                  TEXT NOT NULL CHECK (length(trim(objeto)) > 0),

  -- ── Acerto de contas ────────────────────────────────────────────
  -- Multa por saída antecipada (art. 4º da Lei 8.245/91), proporcional
  -- ao tempo que faltava. `dispensada` é o caso mais comum no acordo, e
  -- precisa estar escrito: perdão de multa que não vira cláusula volta
  -- como cobrança depois.
  multa_valor             NUMERIC(12,2),
  multa_dispensada        BOOLEAN NOT NULL DEFAULT false,
  -- Aluguéis, encargos e contas em aberto até a desocupação.
  debitos_valor           NUMERIC(12,2),
  -- Quanto da caução volta pro locatário (já descontado o que houver).
  caucao_devolver         NUMERIC(12,2),
  acerto_observacao       TEXT,
  -- Quitação recíproca: nada mais a reclamar de parte a parte. Desligar
  -- quando fica pendência (ex: dano em apuração na vistoria de saída).
  quitacao_reciproca      BOOLEAN NOT NULL DEFAULT true,

  -- ── Documento ───────────────────────────────────────────────────
  testemunha_ids          UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  contrato_originario_ref TEXT,
  clausulas               JSONB,
  fechamento              TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ,

  UNIQUE (contrato_id)
);

CREATE INDEX IF NOT EXISTS idx_distratos_user ON contratos_distratos(user_id);

ALTER TABLE contratos_distratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distratos_owner_all ON contratos_distratos;
CREATE POLICY distratos_owner_all ON contratos_distratos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE contratos_distratos IS
  'Distrato (rescisão amigável) do contrato de locação. Um por contrato.';
COMMENT ON COLUMN contratos_distratos.objeto IS
  'Cláusula 1ª — o que as partes estão distratando. Parágrafo em branco separa itens (1.1, 1.2…).';
COMMENT ON COLUMN contratos_distratos.clausulas IS
  'Cláusulas da 2ª em diante, [{titulo, texto}]. NULL = texto padrão (distrato-clausulas.ts).';
COMMENT ON COLUMN contratos_distratos.multa_dispensada IS
  'true = as partes dispensam a multa por saída antecipada. Sai escrito no PDF.';
COMMENT ON COLUMN contratos_distratos.quitacao_reciproca IS
  'true = quitação recíproca, nada mais a reclamar. Desligar quando resta pendência aberta.';

-- ── Assinatura eletrônica do distrato ─────────────────────────────
-- Mesma tabela e mesmo fluxo do contrato e do aditivo (v61/v94); muda
-- só pra onde contrato_id aponta: aqui, contratos_distratos.id.
-- O CHECK é achado pelo conteúdo, não pelo nome — nasceu inline na v61.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'contrato_assinaturas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contrato%'
  LOOP
    EXECUTE format('ALTER TABLE contrato_assinaturas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE contrato_assinaturas
  ADD CONSTRAINT contrato_assinaturas_tipo_contrato_check
  CHECK (tipo_contrato IN ('locacao', 'administracao', 'aditivo_locacao',
                           'aditivo_administracao', 'distrato_locacao'));

COMMENT ON COLUMN contrato_assinaturas.tipo_contrato IS
  'Documento assinado: locacao / administracao (contrato), aditivo_locacao / aditivo_administracao (termo aditivo) ou distrato_locacao (distrato). Define pra onde contrato_id aponta.';

NOTIFY pgrst, 'reload schema';
