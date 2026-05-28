-- ════════════════════════════════════════════════════════════════════
--  CRM v45 — Papel do cônjuge do locatário no contrato
--
--  Antes o cônjuge aparecia na capa e nas assinaturas, mas nunca era
--  qualificado no corpo nem tinha papel definido. Agora:
--   - solidario: locatária(o) solidária — mora, assume, recebe chaves
--   - anuente: cônjuge anuente / ocupante autorizada — assina, não responde
--              solidariamente, não recebe chaves obrigatoriamente
--   - nao_participa: só consta o estado civil, não entra no contrato
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS conjuge_inquilino_papel TEXT NOT NULL DEFAULT 'solidario'
    CHECK (conjuge_inquilino_papel IN ('solidario', 'anuente', 'nao_participa'));

COMMENT ON COLUMN contratos_locacao.conjuge_inquilino_papel IS
  'Papel do cônjuge do locatário: solidario (locatária solidária) | anuente (ocupante autorizada/anuente) | nao_participa';

NOTIFY pgrst, 'reload schema';
