-- ════════════════════════════════════════════════════════════════════
--  CRM v75 — Preferência do proprietário sobre os seguros
--
--  O contrato de administração é onde o proprietário define as regras da
--  gestão do imóvel — e é onde ele autoriza (ou não) a administradora a
--  cotar e contratar seguro em nome dele. Sem essa autorização escrita,
--  contratar apólice pelo sistema é assumir risco jurídico.
--
--  Base legal do incêndio: Lei 8.245/91, art. 22, VIII — o prêmio do
--  seguro contra fogo é obrigação do LOCADOR. O art. 25 permite transferir
--  ao locatário por cláusula expressa, e é o que a maioria faz. Por isso
--  são duas perguntas separadas: QUEM CUIDA e QUEM PAGA.
--
--  Fiança é diferente: não é obrigação de ninguém, é modalidade de
--  garantia. A pergunta ali é quais garantias o proprietário aceita.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contratos_administracao
  -- ── Seguro incêndio ──────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS seguro_incendio_modo TEXT NOT NULL DEFAULT 'a_definir'
    CHECK (seguro_incendio_modo IN (
      'a_definir',                -- ainda não conversado com o proprietário
      'proprietario_possui',      -- ele já tem apólice própria
      'administradora_contrata',  -- autoriza a gente a contratar
      'inquilino_contrata',       -- o locatário resolve por conta
      'dispensado'                -- proprietário dispensa (registrar por escrito!)
    )),
  ADD COLUMN IF NOT EXISTS seguro_incendio_pagador TEXT
    CHECK (seguro_incendio_pagador IN ('proprietario','inquilino')),
  ADD COLUMN IF NOT EXISTS seguro_incendio_seguradora TEXT,
  ADD COLUMN IF NOT EXISTS seguro_incendio_apolice    TEXT,
  ADD COLUMN IF NOT EXISTS seguro_incendio_vencimento DATE,

  -- ── Garantias aceitas na locação ─────────────────────────────────
  -- Vazio = o proprietário não restringiu; o corretor escolhe.
  ADD COLUMN IF NOT EXISTS garantias_aceitas TEXT[] NOT NULL DEFAULT '{}',

  -- ── Autorização para cotar/contratar ─────────────────────────────
  ADD COLUMN IF NOT EXISTS autoriza_cotacao_seguros BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seguros_observacoes TEXT;

COMMENT ON COLUMN contratos_administracao.seguro_incendio_modo IS
  'Como o seguro incêndio será tratado. Lei 8.245/91 art. 22 VIII: o prêmio é obrigação do locador; art. 25 permite repassar ao locatário por cláusula expressa.';
COMMENT ON COLUMN contratos_administracao.seguro_incendio_pagador IS
  'Quem arca com o prêmio. Independe de quem contrata: a administradora pode contratar e o inquilino pagar.';
COMMENT ON COLUMN contratos_administracao.garantias_aceitas IS
  'Subconjunto de fiador/caucao/seguro_fianca/sem_garantia que o proprietário aceita. Vazio = sem restrição.';
COMMENT ON COLUMN contratos_administracao.autoriza_cotacao_seguros IS
  'Autorização expressa pra administradora cotar e contratar seguro em nome do proprietário. Sem isso, o sistema não oferece o botão de contratar.';

NOTIFY pgrst, 'reload schema';
