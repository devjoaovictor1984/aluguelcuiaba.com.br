-- ════════════════════════════════════════════════════════════════════
--  CRM v68 — Novo papel: Representante legal / Interveniente anuente
--
--  Papel genérico pra quem assina o contrato como interveniente anuente /
--  representante legal de uma das partes (ex.: representante legal do
--  inquilino, terceiro anuente que não se encaixa em responsável pelo
--  seguro nem caucionante). NÃO mora no imóvel e NÃO recebe chaves; entra
--  apenas no bloco de assinaturas.
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
    'caucionante',
    'interveniente_anuente'
  ));

COMMENT ON COLUMN contratos_moradores.papel IS
  'morador | inquilino_solidario | socio_signatario | responsavel_seguro | conjuge_responsavel_seguro | ocupante_autorizado | caucionante | interveniente_anuente';

NOTIFY pgrst, 'reload schema';
