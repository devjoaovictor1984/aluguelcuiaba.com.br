-- ════════════════════════════════════════════════════════════════════
--  CRM v66 — Texto editável da garantia na CAPA do contrato de locação
--
--  A capa monta a garantia automaticamente a partir de garantia_tipo
--  ("Sem garantia", "Fiador", "Caução · R$ X", "Seguro fiança — …").
--  Em alguns contratos o corretor quer ajustar esse texto (ex.: não há
--  garantia locatícia formal, mas há interveniente anuente / sócio
--  signatário). Este campo guarda um override por geração: quando
--  preenchido, a capa usa ele no lugar do texto automático.
--
--  100% aditivo: nulo = comportamento atual (texto automático).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS capa_garantia_texto TEXT;

COMMENT ON COLUMN contrato_geracoes.capa_garantia_texto IS
  'Override do texto da GARANTIA na capa do contrato. Nulo = texto automatico a partir de garantia_tipo.';

NOTIFY pgrst, 'reload schema';
