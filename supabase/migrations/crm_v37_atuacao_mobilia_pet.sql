-- ════════════════════════════════════════════════════════════════════
--  CRM v37 — Tipo de atuação, mobília e política de pet
--
--  Antes: todo contrato era tratado como "locação com administração
--  imobiliária". Agora suporta intermediação e locação direta.
--
--  Antes: contrato não sabia se o imóvel era mobiliado nem se aceitava
--  pet. Agora essas escolhas geram cláusulas específicas no PDF.
-- ════════════════════════════════════════════════════════════════════

-- Tipo de atuação do corretor no contrato
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS tipo_atuacao TEXT NOT NULL DEFAULT 'administracao'
    CHECK (tipo_atuacao IN ('administracao','intermediacao','direto'));

-- Se for intermediação, o corretor pode optar por assinar o contrato
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS intermediador_assina BOOLEAN NOT NULL DEFAULT FALSE;

-- Mobília do imóvel
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS tipo_mobilia TEXT NOT NULL DEFAULT 'sem'
    CHECK (tipo_mobilia IN ('sem','semi','parcial','total'));

-- Sinaliza se há inventário anexado (alerta no checklist se mobiliado sem inventário)
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS tem_inventario_bens BOOLEAN NOT NULL DEFAULT FALSE;

-- Política de pet
ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS aceita_pet TEXT NOT NULL DEFAULT 'nao'
    CHECK (aceita_pet IN ('sim','nao','autorizacao','condominio'));

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS pet_observacao TEXT;

COMMENT ON COLUMN contratos_locacao.tipo_atuacao IS
  'administracao = corretor administra; intermediacao = só intermediou; direto = sem corretor';
COMMENT ON COLUMN contratos_locacao.tipo_mobilia IS
  'sem | semi | parcial | total — controla cláusulas de mobília e inventário';
COMMENT ON COLUMN contratos_locacao.aceita_pet IS
  'nao | sim | autorizacao (mediante autorização) | condominio (conforme regras)';

-- ─── Novos tipos de cláusula ──
ALTER TABLE contrato_clausulas
  DROP CONSTRAINT IF EXISTS contrato_clausulas_tipo_check;

ALTER TABLE contrato_clausulas
  ADD CONSTRAINT contrato_clausulas_tipo_check
  CHECK (tipo IN (
    'generica',
    'sem_garantia',
    'caucao',
    'fiador',
    'seguro_fianca',
    'seguro_incendio',
    'adicional',
    'administracao',
    'atuacao',         -- variantes de "Das partes" (administracao/intermediacao/direta)
    'fundamentacao',   -- cláusula introdutória da Lei 8.245/91
    'mobilia',         -- variantes de mobília (sem/semi/parcial/total) + inventário
    'pet'              -- política de pet (sim/nao/autorizacao/condominio) + limpeza
  ));

