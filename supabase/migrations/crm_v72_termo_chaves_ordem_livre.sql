-- ════════════════════════════════════════════════════════════════════
--  CRM v72 — Termo de entrega de chaves: assinatura em ordem livre
--
--  Até a v51 o fluxo era estritamente sequencial: o locatário assinava
--  pelo magic link e SÓ DEPOIS a administradora confirmava no painel.
--  Na prática a entrega costuma ser presencial — a administradora quer
--  assinar na hora, sem depender do locatário abrir o link antes.
--
--  Novo status intermediário `assinado_locador`: administradora já
--  assinou, falta o locatário. Espelha `assinado_locatario`.
--
--  Máquina de estados resultante (as duas ordens levam a 'assinado'):
--
--    rascunho → enviada ─┬─ locatário assina  → assinado_locatario ─┐
--                        │                                          ├→ assinado
--                        └─ administradora    → assinado_locador   ─┘
--
--    'recusada' continua acessível a partir de 'enviada' e de
--    'assinado_locador' (o locatário pode recusar mesmo depois de a
--    administradora ter assinado).
--
--  A propagação pro contrato (chaves_entregues_em / qtd_chaves_entregues)
--  passa a acontecer no lado que FECHA o termo, seja ele qual for.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE termos_entrega_chaves
  DROP CONSTRAINT IF EXISTS termos_entrega_chaves_status_check;

ALTER TABLE termos_entrega_chaves
  ADD CONSTRAINT termos_entrega_chaves_status_check
  CHECK (status IN (
    'rascunho',
    'enviada',
    'assinado_locatario',
    'assinado_locador',
    'assinado',
    'recusada'
  ));

COMMENT ON COLUMN termos_entrega_chaves.status IS
  'rascunho | enviada | assinado_locatario (falta administradora) | assinado_locador (falta locatário) | assinado | recusada';

NOTIFY pgrst, 'reload schema';
