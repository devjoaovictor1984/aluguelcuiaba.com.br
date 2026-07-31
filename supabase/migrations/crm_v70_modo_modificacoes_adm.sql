-- ════════════════════════════════════════════════════════════════════
--  CRM v70 — Modo "modificações" no contrato de ADMINISTRAÇÃO
--
--  Espelha a v69 (locação) para o contrato de administração. O corretor
--  marca as cláusulas alteradas (flag `modificada` em cada item do JSONB
--  `clausulas` de contrato_admin_geracoes — sem coluna nova) e escreve um
--  texto que vira um QUADRO de destaque no PDF.
--
--  Visibilidade:
--    - Link de revisão (?rt=token): SEMPRE mostra (forçado na rota).
--    - PDF normal/final: só mostra se `mostrar_modificacoes` = true.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_admin_geracoes
  ADD COLUMN IF NOT EXISTS mostrar_modificacoes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modificacoes_texto    TEXT;

COMMENT ON COLUMN contrato_admin_geracoes.mostrar_modificacoes IS
  'Liga os destaques de modificação no PDF normal. O link de revisão (?rt) sempre mostra, independente disso.';
COMMENT ON COLUMN contrato_admin_geracoes.modificacoes_texto IS
  'Texto livre de modificações/considerações exibido como quadro de destaque no topo das cláusulas.';

NOTIFY pgrst, 'reload schema';
