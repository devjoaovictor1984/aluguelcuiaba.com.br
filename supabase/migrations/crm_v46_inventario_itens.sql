-- ════════════════════════════════════════════════════════════════════
--  CRM v46 — Inventário de bens estruturado (item a item)
--
--  Quando o imóvel é mobiliado, o corretor cadastra os bens item a item.
--  O PDF gera uma tabela de inventário (descrição, qtd, marca/modelo,
--  estado) conferível na devolução.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrato_inventario_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   UUID NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  descricao     TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  quantidade    INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
  marca_modelo  TEXT,
  estado        TEXT,   -- novo / bom / regular / ruim (texto livre)
  observacao    TEXT,
  ordem         INTEGER NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventario_contrato
  ON contrato_inventario_itens(contrato_id, ordem);

ALTER TABLE contrato_inventario_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventario_select_own ON contrato_inventario_itens;
CREATE POLICY inventario_select_own ON contrato_inventario_itens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS inventario_insert_own ON contrato_inventario_itens;
CREATE POLICY inventario_insert_own ON contrato_inventario_itens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS inventario_update_own ON contrato_inventario_itens;
CREATE POLICY inventario_update_own ON contrato_inventario_itens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS inventario_delete_own ON contrato_inventario_itens;
CREATE POLICY inventario_delete_own ON contrato_inventario_itens
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
