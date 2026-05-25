-- ════════════════════════════════════════════════════════════════════
--  CRM v26 — Origem do item da vistoria
--
--  O inquilino, ao revisar a vistoria pelo link público, agora pode
--  reportar problemas que não estavam no checklist do corretor
--  (infiltração nova, falha elétrica descoberta, vazamento, etc.).
--
--  Essa coluna marca quem criou o item: 'corretor' (padrão, vem do
--  fluxo normal) ou 'inquilino' (item adicionado via tela pública).
--  No PDF, itens com origem='inquilino' aparecem destacados.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE vistoria_itens
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'corretor'
    CHECK (origem IN ('corretor', 'inquilino'));

COMMENT ON COLUMN vistoria_itens.origem IS
  'Quem criou o item. corretor = adicionado no editor da vistoria; inquilino = reportado pelo inquilino via link público.';

NOTIFY pgrst, 'reload schema';
