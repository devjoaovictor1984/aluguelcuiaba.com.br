-- ════════════════════════════════════════════════════════════════════
--  CRM v43 — Novos papéis das partes no contrato
--
--  O modelo antigo só tinha morador / inquilino_solidario / socio_signatario.
--  Agora suporta a realidade dos papéis:
--   - responsavel_seguro: passou o seguro fiança mas pode não morar
--                         (ex: pai passa o seguro, filho mora). Assina como
--                         interveniente anuente, NÃO recebe chaves.
--   - conjuge_responsavel_seguro: cônjuge do acima, assina só se exigido
--   - ocupante_autorizado: mora mas não assume obrigação principal
--   - caucionante: terceiro que paga a caução (interveniente anuente)
-- ════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contratos_moradores_papel_check'
  ) THEN
    ALTER TABLE contratos_moradores DROP CONSTRAINT contratos_moradores_papel_check;
  END IF;
END$$;

ALTER TABLE contratos_moradores
  ADD CONSTRAINT contratos_moradores_papel_check
  CHECK (papel IN (
    'morador',
    'inquilino_solidario',
    'socio_signatario',
    'responsavel_seguro',
    'conjuge_responsavel_seguro',
    'ocupante_autorizado',
    'caucionante'
  ));

-- Flag: a pessoa assina o contrato? (responsável pelo seguro / caucionante /
-- cônjuge geralmente assinam; ocupante autorizado normalmente não)
ALTER TABLE contratos_moradores
  ADD COLUMN IF NOT EXISTS assina_contrato BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN contratos_moradores.papel IS
  'morador | inquilino_solidario | socio_signatario | responsavel_seguro | conjuge_responsavel_seguro | ocupante_autorizado | caucionante';
COMMENT ON COLUMN contratos_moradores.assina_contrato IS
  'Se TRUE, a pessoa entra no bloco de assinaturas. Ocupante autorizado costuma ser FALSE.';

NOTIFY pgrst, 'reload schema';
