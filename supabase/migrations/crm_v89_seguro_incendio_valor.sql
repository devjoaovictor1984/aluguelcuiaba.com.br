-- ─────────────────────────────────────────────────────────────────────
-- v89 · Valor aproximado do seguro incêndio no anúncio
--
-- POR QUE: a v88 trouxe "seguro incêndio obrigatório" pro anúncio, mas
-- obrigatório sem preço é meia informação — quem procura quer saber
-- quanto vai custar, e é a pergunta que chega pelo WhatsApp.
--
-- ANUAL, e não mensal como o seguro fiança: é assim que a apólice de
-- incêndio é vendida e cobrada, e é assim que o anúncio mostra.
--
-- Aproximado e digitado pelo anunciante: o prêmio real depende do valor
-- do imóvel, das coberturas escolhidas e da seguradora.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS seguro_incendio_valor NUMERIC(12,2);

COMMENT ON COLUMN imoveis.seguro_incendio_valor IS
  'Valor ANUAL aproximado do seguro incêndio, digitado pelo anunciante. Estimativa: o prêmio real depende do valor do imóvel e das coberturas. NULL = não informado.';

NOTIFY pgrst, 'reload schema';
