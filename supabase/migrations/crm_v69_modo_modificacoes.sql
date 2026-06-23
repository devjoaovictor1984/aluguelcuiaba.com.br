-- ════════════════════════════════════════════════════════════════════
--  CRM v69 — Modo "modificações" no contrato (destaque pro cliente revisar)
--
--  O corretor marca as cláusulas que alterou (flag `modificada` em cada
--  item do snapshot JSONB `clausulas` — não precisa de coluna nova) e
--  escreve um texto de considerações que vira um QUADRO de destaque no PDF.
--
--  Visibilidade:
--    - Link de revisão (?rt=token): SEMPRE mostra (forçado na rota).
--    - PDF normal/final: só mostra se `mostrar_modificacoes` = true.
--      Pra gerar/assinar o contrato limpo, o corretor desmarca o interruptor.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS mostrar_modificacoes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modificacoes_texto    TEXT;

COMMENT ON COLUMN contrato_geracoes.mostrar_modificacoes IS
  'Liga os destaques de modificação no PDF normal. O link de revisão (?rt) sempre mostra, independente disso.';
COMMENT ON COLUMN contrato_geracoes.modificacoes_texto IS
  'Texto livre de modificações/considerações exibido como quadro de destaque no topo das cláusulas.';

NOTIFY pgrst, 'reload schema';
