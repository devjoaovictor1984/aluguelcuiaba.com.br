-- ════════════════════════════════════════════════════════════════════
--  CRM v38 — "Aluguel pacote" (encargos inclusos no valor)
--
--  Quando o aluguel mensal já inclui IPTU, condomínio, água, energia,
--  gás ou internet (parcial ou totalmente), a cláusula 7 (aluguel e
--  encargos) e a cláusula 16 (obrigações do locatário) precisam refletir
--  isso. Auto-inject escolhe variante "pacote" se qualquer flag for true.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS aluguel_inclui_iptu        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_condominio  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_agua        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_energia     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_gas         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_internet    BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN contratos_locacao.aluguel_inclui_iptu IS
  'TRUE = IPTU já está embutido no valor do aluguel (não cobrado à parte)';
COMMENT ON COLUMN contratos_locacao.aluguel_inclui_condominio IS
  'TRUE = condomínio já está embutido no aluguel';

-- ─── Novo tipo de cláusula 'aluguel_pacote' ──
ALTER TABLE contrato_clausulas
  DROP CONSTRAINT IF EXISTS contrato_clausulas_tipo_check;

ALTER TABLE contrato_clausulas
  ADD CONSTRAINT contrato_clausulas_tipo_check
  CHECK (tipo IN (
    'generica','sem_garantia','caucao','fiador','seguro_fianca','seguro_incendio',
    'adicional','administracao','atuacao','fundamentacao','mobilia','pet',
    'aluguel_pacote'
  ));

