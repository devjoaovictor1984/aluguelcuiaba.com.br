-- ════════════════════════════════════════════════════════════════════
--  CRM v6 — Inquilino contratante reside no imóvel?
--  Caso comum: pai assina o contrato e passa o seguro fiança no nome dele,
--  mas quem mora é o filho. Flag indica se o inquilino contratante mora.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS inquilino_mora_no_imovel BOOLEAN NOT NULL DEFAULT TRUE;

NOTIFY pgrst, 'reload schema';
