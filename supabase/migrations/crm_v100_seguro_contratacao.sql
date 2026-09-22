-- ─────────────────────────────────────────────────────────────────────
-- v100 · Nº da contratação do seguro fiança (intermediadora)
--
-- POR QUE: o número da APÓLICE não sai rápido. A seguradora emite dias
-- depois e manda por e-mail. Enquanto isso o contrato precisa ir pra
-- assinatura, e a v97 fazia o contrário: cobrava o número da apólice
-- antes de enviar (assinatura-actions.ts), o que travava tudo.
--
-- O que existe NA HORA é o número da contratação, que a intermediadora
-- devolve assim que o seguro é fechado:
--
--     Contratação Seguro: 227638
--
-- Esse número identifica a operação e é o que vai impresso no contrato.
-- A apólice entra depois, quando o PDF chega por e-mail e é anexado em
-- contratos_documentos (v97) — de onde o nº da apólice continua sendo
-- preenchido sozinho em seguro_fianca_apolice.
--
-- seguro_fianca_apolice NÃO sai: só deixa de ser pedido no cadastro e
-- de travar o envio pra assinatura.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS seguro_fianca_contratacao TEXT;

COMMENT ON COLUMN contratos_locacao.seguro_fianca_contratacao IS
  'Nº da contratação do seguro fiança na intermediadora (ex: Maximiza "Contratação Seguro: 227638"). Sai na hora do fechamento e é o que vai impresso no contrato. NULL = não informado.';

COMMENT ON COLUMN contratos_locacao.seguro_fianca_apolice IS
  'Nº da apólice emitida pela seguradora. Chega dias depois, por e-mail; normalmente preenchido ao anexar o PDF da apólice. Não é exigido para gerar nem para assinar.';

-- ── Cláusulas já salvas ──────────────────────────────────────────────
-- O seed novo só vale pra quem importar daqui pra frente. Quem já tem as
-- cláusulas no banco continuaria com "apólice nº {{SEGURO_APOLICE}}", que
-- agora sai VAZIO no contrato — pior que antes. Então o texto é trocado
-- aqui, no mesmo lugar onde a coluna nasce.
--
-- A troca é só do trecho, sem mexer na numeração dos parágrafos: por isso
-- o aviso da apólice por e-mail entra no próprio caput, e não como um
-- parágrafo novo. Cláusula editada à mão que não contenha o trecho exato
-- fica intacta — e aparece na conferência abaixo.

UPDATE contrato_clausulas
SET corpo = REPLACE(
      corpo,
      'apólice nº {{SEGURO_APOLICE}}, conforme proposta, coberturas, condições gerais e critérios de aceitação da seguradora.',
      'sob o nº de contratação {{SEGURO_CONTRATACAO}}, conforme proposta, coberturas, condições gerais e critérios de aceitação da seguradora. A apólice é emitida pela seguradora após a contratação e será enviada por e-mail ao LOCATÁRIO e à ADMINISTRADORA, passando a integrar este contrato independentemente de aditivo; até a emissão, a garantia é comprovada pelo número de contratação acima.'
    )
WHERE corpo LIKE '%apólice nº {{SEGURO_APOLICE}}, conforme proposta%';

UPDATE contrato_clausulas
SET corpo = REPLACE(
      corpo,
      'apólice nº {{SEGURO_APOLICE}}, é de responsabilidade financeira',
      'sob o nº de contratação {{SEGURO_CONTRATACAO}}, é de responsabilidade financeira'
    )
WHERE corpo LIKE '%apólice nº {{SEGURO_APOLICE}}, é de responsabilidade financeira%';

-- Conferência: se voltar alguma linha, essa cláusula foi editada à mão e
-- ainda cita a apólice — reveja o texto na tela de cláusulas.
SELECT id, titulo
FROM contrato_clausulas
WHERE corpo LIKE '%{{SEGURO_APOLICE}}%';

NOTIFY pgrst, 'reload schema';
