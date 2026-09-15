-- ─────────────────────────────────────────────────────────────────────
-- v95 · Como o termo aditivo cita o contrato originário
--
-- POR QUE: o aditivo citava sempre "Contrato originário nº <código
-- interno>, firmado em <data do cadastro>". Pra contrato feito antes da
-- plataforma (ou assinado no papel) isso é falso nas duas pontas: o
-- número é o da plataforma, não o do papel, e a data é a do cadastro.
--
-- Agora, por padrão, número e data só entram quando o contrato foi
-- ASSINADO PELA PLATAFORMA (geração com status 'assinado', data real da
-- assinatura). Nos outros casos o aditivo cita "o contrato celebrado
-- entre as partes", sem número. E cada aditivo pode trazer o texto como
-- está no papel ("nº 045/2023, firmado em 10/01/2023").
--
-- contrato_originario_ref: NULL = regra automática acima.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_aditivos
  ADD COLUMN IF NOT EXISTS contrato_originario_ref TEXT;

ALTER TABLE contratos_administracao_aditivos
  ADD COLUMN IF NOT EXISTS contrato_originario_ref TEXT;

COMMENT ON COLUMN contratos_aditivos.contrato_originario_ref IS
  'Como o aditivo cita o contrato originário (ex.: "nº 045/2023, firmado em 10/01/2023"). NULL = número e data da plataforma só se o contrato foi assinado por ela; senão, sem número.';
COMMENT ON COLUMN contratos_administracao_aditivos.contrato_originario_ref IS
  'Como o aditivo cita o contrato originário (ex.: "nº 045/2023, firmado em 10/01/2023"). NULL = número e data da plataforma só se o contrato foi assinado por ela; senão, sem número.';

NOTIFY pgrst, 'reload schema';
