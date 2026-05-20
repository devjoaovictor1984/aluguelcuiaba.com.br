-- ════════════════════════════════════════════════════════════════════
--  CRM v22 — Fotos com escopo (geral / cômodo / item)
--
--  Antes: cada foto tinha que estar vinculada a um vistoria_item.
--  Agora: foto pode ser de 3 escopos:
--    1. Geral da vistoria       → comodo IS NULL  + vistoria_item_id IS NULL
--    2. Geral do cômodo          → comodo = 'Sala' + vistoria_item_id IS NULL
--    3. De um item específico    → comodo = 'Sala' + vistoria_item_id = X (atual)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE vistoria_fotos
  ADD COLUMN IF NOT EXISTS comodo TEXT;

-- Backfill: pra fotos que já estão vinculadas a itens, deriva o cômodo
UPDATE vistoria_fotos f
   SET comodo = i.comodo
  FROM vistoria_itens i
 WHERE f.vistoria_item_id = i.id
   AND f.comodo IS NULL;

CREATE INDEX IF NOT EXISTS vistoria_fotos_comodo_idx
  ON vistoria_fotos (vistoria_id, comodo);

NOTIFY pgrst, 'reload schema';
