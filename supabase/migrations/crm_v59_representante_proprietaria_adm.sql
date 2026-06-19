-- ════════════════════════════════════════════════════════════════════
--  CRM v59 — Representante/responsável da proprietária (contrato de administração)
--
--  Quando a PROPRIETÁRIA é pessoa jurídica (empresa), quem assina é seu
--  sócio/representante legal. Este campo vincula esse representante (uma
--  pessoa cadastrada) e a qualidade dele (ex.: sócio-administrador).
--
--  O preâmbulo (cláusula "Das partes") ganha o placeholder
--  {{ADM_PROPRIETARIO_REPRESENTANTE}}, que só rende texto quando há
--  representante. 100% aditivo.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_administracao
  ADD COLUMN IF NOT EXISTS proprietario_representante_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proprietario_representante_qualificacao TEXT;

COMMENT ON COLUMN contratos_administracao.proprietario_representante_id IS
  'Pessoa que representa a proprietária PJ na assinatura (sócio/representante legal). NULL quando proprietária é PF ou assina diretamente.';
COMMENT ON COLUMN contratos_administracao.proprietario_representante_qualificacao IS
  'Qualidade do representante (ex.: sócio-administrador, procurador). Default no contrato: "representante legal".';

-- Insere o placeholder no preâmbulo (cláusula "Das partes" de administração), idempotente.
UPDATE contrato_clausulas
   SET corpo = corpo || E'\n\n{{ADM_PROPRIETARIO_REPRESENTANTE}}'
 WHERE tipo = 'administracao'
   AND categoria = 'partes'
   AND corpo NOT LIKE '%ADM_PROPRIETARIO_REPRESENTANTE%';

NOTIFY pgrst, 'reload schema';
