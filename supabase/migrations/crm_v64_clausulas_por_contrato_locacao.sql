-- ════════════════════════════════════════════════════════════════════
--  CRM v64 — Cláusulas POR CONTRATO (snapshot) no contrato de LOCAÇÃO
--
--  Mesma proteção da v63 (que fez isso pro contrato de administração),
--  agora pra locação. Antes, a geração guardava só `clausula_ids` —
--  referências ao banco. Problemas:
--    1) editar o texto de uma cláusula mexia no BANCO compartilhado e
--       vazava pra todos os contratos futuros que a usam;
--    2) reimportar o modelo apagava as cláusulas do banco e recriava com
--       IDs novos → contratos antigos ficavam com `clausula_ids` órfãos e
--       PERDIAM cláusulas no PDF.
--
--  Agora cada geração guarda a sua PRÓPRIA cópia (snapshot JSONB). Ao criar
--  o contrato, copia o banco; as edições ficam só naquele contrato; o banco
--  segue genérico. Gerações antigas fazem backfill automático ao abrir o
--  editor (a partir dos clausula_ids).
--
--  Formato: [{ "id": uuid, "titulo": ..., "corpo": ..., "categoria": ..., "tipo": ... }]
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS clausulas JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contrato_geracoes.clausulas IS
  'Snapshot das cláusulas DESTE contrato (cópia editável, independente do banco). Substitui o uso de clausula_ids.';

NOTIFY pgrst, 'reload schema';
