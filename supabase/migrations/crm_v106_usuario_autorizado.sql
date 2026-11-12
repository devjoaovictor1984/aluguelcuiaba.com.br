-- ════════════════════════════════════════════════════════════════════
--  CRM v106 — Usuário autorizado (ocupante autorizado) com responsabilidades
--
--  Caso que motivou: o seguro fiança sai no nome do sogro (locatário),
--  mas quem usa a sala é o genro. Ele assina como interveniente anuente,
--  recebe as chaves e fica com a conta de luz — sem virar locatário.
--
--  O papel continua sendo `ocupante_autorizado` (o rótulo muda conforme a
--  finalidade: "usuário comercial autorizado" em contrato comercial). Aqui
--  só entram os dados que o papel não diz sozinho:
--
--  contratos_moradores
--   · consumos_titular       contas que a pessoa É OBRIGADA a passar pro
--                            nome dela (energia/agua/gas/internet). Vazio =
--                            só autorizada, sem obrigação (o que já valia).
--   · atividade_no_imovel    "escritório de advocacia, OAB/MT nº ..."
--   · titularidade_confirmada_em / titularidade_comprovante_id
--                            a troca só conta como feita com comprovante —
--                            a cláusula assinada não basta.
--
--  contratos_locacao
--   · prazo_titularidade_dias_uteis   prazo da troca após a entrega (10)
--   · seguradora_ciente_usuario_em/_obs/_comprovante_id
--                            a seguradora aprovou o locatário, não o uso
--                            por terceiro: fica pendente até registrar.
--
--  Retrocompatível: tudo com default neutro. Contrato antigo não ganha
--  obrigação nova nem pendência que trave.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_moradores
  ADD COLUMN IF NOT EXISTS consumos_titular TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS atividade_no_imovel TEXT,
  ADD COLUMN IF NOT EXISTS titularidade_confirmada_em DATE,
  ADD COLUMN IF NOT EXISTS titularidade_comprovante_id UUID
    REFERENCES contratos_documentos(id) ON DELETE SET NULL;

ALTER TABLE contratos_moradores DROP CONSTRAINT IF EXISTS contratos_moradores_consumos_check;
ALTER TABLE contratos_moradores
  ADD CONSTRAINT contratos_moradores_consumos_check
  CHECK (consumos_titular <@ ARRAY['energia','agua','gas','internet']::TEXT[]);

COMMENT ON COLUMN contratos_moradores.consumos_titular IS
  'Contas de consumo que a pessoa se obriga a transferir para o próprio nome (energia, agua, gas, internet).';
COMMENT ON COLUMN contratos_moradores.atividade_no_imovel IS
  'Atividade exercida no imóvel pelo usuário autorizado (ex.: escritório de advocacia, OAB/MT nº ...).';
COMMENT ON COLUMN contratos_moradores.titularidade_confirmada_em IS
  'Data em que a troca de titularidade foi comprovada. NULL = pendente.';

ALTER TABLE contratos_locacao
  ADD COLUMN IF NOT EXISTS prazo_titularidade_dias_uteis SMALLINT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS seguradora_ciente_usuario_em DATE,
  ADD COLUMN IF NOT EXISTS seguradora_ciente_usuario_obs TEXT,
  ADD COLUMN IF NOT EXISTS seguradora_ciente_comprovante_id UUID
    REFERENCES contratos_documentos(id) ON DELETE SET NULL;

ALTER TABLE contratos_locacao DROP CONSTRAINT IF EXISTS contratos_locacao_prazo_titularidade_check;
ALTER TABLE contratos_locacao
  ADD CONSTRAINT contratos_locacao_prazo_titularidade_check
  CHECK (prazo_titularidade_dias_uteis BETWEEN 1 AND 90);

COMMENT ON COLUMN contratos_locacao.seguradora_ciente_usuario_em IS
  'Data em que a seguradora do seguro fiança foi informada/aceitou o uso do imóvel por usuário autorizado.';
