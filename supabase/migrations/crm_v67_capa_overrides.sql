-- ════════════════════════════════════════════════════════════════════
--  CRM v67 — Overrides da CAPA (campos editáveis) — locação e administração
--
--  Generaliza o override da capa (que na v66 era só a garantia): agora um
--  JSONB por geração guarda overrides de qualquer campo da capa, mais uma
--  linha de observação livre.
--
--  Chaves usadas:
--    Locação:       aluguel, prazo, inicio, termino, garantia, endereco,
--                   descricao, observacao
--    Administração: taxa, prazo, inicio, termino, repasse, exclusividade,
--                   endereco, descricao, observacao
--
--  Vazio/ausente = usa o valor automático. 100% aditivo.
--  A v66 (capa_garantia_texto) segue valendo como fallback de garantia.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS capa_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE contrato_admin_geracoes
  ADD COLUMN IF NOT EXISTS capa_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN contrato_geracoes.capa_overrides IS
  'Overrides dos campos da capa (JSON chave->texto). Vazio = valor automatico.';
COMMENT ON COLUMN contrato_admin_geracoes.capa_overrides IS
  'Overrides dos campos da capa (JSON chave->texto). Vazio = valor automatico.';

NOTIFY pgrst, 'reload schema';
