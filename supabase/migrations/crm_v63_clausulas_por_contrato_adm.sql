-- ════════════════════════════════════════════════════════════════════
--  CRM v63 — Cláusulas POR CONTRATO (snapshot) no contrato de administração
--
--  Antes, editar uma cláusula no editor alterava o BANCO compartilhado, e
--  todos os contratos herdavam a edição. Agora cada geração guarda a sua
--  PRÓPRIA cópia das cláusulas (snapshot JSONB). Ao criar um contrato, ele
--  copia o banco genérico; as edições ficam só naquele contrato; o banco
--  permanece genérico para os próximos.
--
--  Formato: [{ "id": uuid, "titulo": ..., "corpo": ..., "categoria": ... }]
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_admin_geracoes
  ADD COLUMN IF NOT EXISTS clausulas JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contrato_admin_geracoes.clausulas IS
  'Snapshot das cláusulas DESTE contrato (cópia editável, independente do banco). Substitui o uso de clausula_ids.';

NOTIFY pgrst, 'reload schema';
