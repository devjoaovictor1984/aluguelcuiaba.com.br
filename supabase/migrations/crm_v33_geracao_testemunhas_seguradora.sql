-- ════════════════════════════════════════════════════════════════════
--  CRM v33 — Testemunhas e cláusulas da seguradora
--
--  testemunha_ids: array de até 2 IDs em pessoas (tipo='testemunha' ou
--    qualquer outro, o corretor escolhe). Aparece na folha de assinatura
--    do PDF já com nome/CPF/RG preenchidos, em vez de linhas em branco.
--
--  clausulas_seguradora_texto: campo livre pra colar cláusulas que a
--    seguradora fornece quando a garantia é seguro fiança. Renderizado
--    no PDF logo antes da folha de assinatura.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS testemunha_ids              UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS clausulas_seguradora_texto  TEXT;

COMMENT ON COLUMN contrato_geracoes.testemunha_ids IS
  'IDs em pessoas pras testemunhas que devem aparecer pré-preenchidas na folha de assinatura. Máx. 2.';
COMMENT ON COLUMN contrato_geracoes.clausulas_seguradora_texto IS
  'Texto livre com as cláusulas próprias da seguradora (Porto, Tokio, etc.). Renderizado no PDF antes da assinatura quando preenchido.';

NOTIFY pgrst, 'reload schema';
