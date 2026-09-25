-- ─────────────────────────────────────────────────────────────────────
-- v104 · Renovação do seguro incêndio: a pendência que fica em aberto
--
-- POR QUE: a apólice de incêndio dura 12 meses; o contrato, 30. Quando a
-- locação é prorrogada, a apólice vence no meio do caminho e ninguém é
-- avisado — o imóvel segue alugado e sem cobertura, e a falha só aparece
-- no dia do sinistro, que é o pior dia possível pra descobrir.
--
-- A pendência em si NÃO é guardada: ela é calculada de
-- seguro-incendio-situacao.ts, comparando a vigência da apólice anexada
-- (v97) com hoje e com o término do contrato. Estado calculado não
-- dessincroniza — uma apólice nova anexada já apaga o aviso sozinha, e
-- contrato encerrado para de cobrar sem ninguém precisar lembrar.
--
-- O que PRECISA ser guardado é a única coisa que o sistema não tem como
-- deduzir: a decisão de não exigir apólice neste contrato. Acontece —
-- proprietário que contratou por fora e não manda o PDF, imóvel em
-- condomínio com seguro coletivo, contrato antigo. Sem isso o aviso
-- ficaria pra sempre na tela, e aviso que não sai vira aviso ignorado.
--
-- A dispensa é do CONTRATO, não do imóvel: o próximo contrato do mesmo
-- imóvel volta a exigir, porque a decisão foi daquele proprietário
-- naquela locação.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS seguro_incendio_dispensado_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seguro_incendio_dispensado_motivo TEXT;

COMMENT ON COLUMN contratos_locacao.seguro_incendio_dispensado_em IS
  'Quando a exigência de apólice de incêndio foi dispensada neste contrato. NULL = o CRM continua cobrando a apólice vigente.';
COMMENT ON COLUMN contratos_locacao.seguro_incendio_dispensado_motivo IS
  'Por que foi dispensada (ex: seguro coletivo do condomínio, contratado por fora sem PDF). Aparece no aviso da tela do contrato.';

NOTIFY pgrst, 'reload schema';
