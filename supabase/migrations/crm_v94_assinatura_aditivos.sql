-- ─────────────────────────────────────────────────────────────────────
-- v94 · Assinatura eletrônica também dos termos aditivos
--
-- POR QUE: a assinatura pela plataforma (selfie, código por e-mail,
-- assinatura desenhada, certificado e código de validação) só aceitava o
-- CONTRATO. O aditivo — que muda valor, prazo, garantia — saía só em PDF
-- pra imprimir e assinar à mão, fora da trilha de auditoria.
--
-- O processo é o mesmo, na mesma tabela. Muda só pra onde contrato_id
-- aponta, conforme o tipo:
--   locacao               → contrato_geracoes.id
--   administracao         → contratos_administracao.id
--   aditivo_locacao       → contratos_aditivos.id                (novo)
--   aditivo_administracao → contratos_administracao_aditivos.id  (novo)
--
-- Idempotente: pode rodar mais de uma vez. O CHECK antigo é achado pelo
-- conteúdo, não pelo nome, porque foi criado inline na v61 e o nome é o
-- que o Postgres gerou.
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'contrato_assinaturas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_contrato%'
  LOOP
    EXECUTE format('ALTER TABLE contrato_assinaturas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE contrato_assinaturas
  ADD CONSTRAINT contrato_assinaturas_tipo_contrato_check
  CHECK (tipo_contrato IN ('locacao', 'administracao', 'aditivo_locacao', 'aditivo_administracao'));

COMMENT ON COLUMN contrato_assinaturas.tipo_contrato IS
  'Documento assinado: locacao / administracao (contrato) ou aditivo_locacao / aditivo_administracao (termo aditivo). Define pra onde contrato_id aponta.';

NOTIFY pgrst, 'reload schema';
