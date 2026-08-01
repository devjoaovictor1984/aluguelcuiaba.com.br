-- ════════════════════════════════════════════════════════════════════
--  CRM v76 — Preço de referência junto ao parecer
--
--  No painel da corretora o preço aparece dentro do card de cada
--  seguradora, junto do parecer — o corretor vê "aprovado" e "29x de
--  R$ 626,37" na mesma olhada. É a informação que ele repassa ao cliente.
--
--  Guardamos o resultado de consultarPrecosApi aqui em vez de chamar a
--  API a cada abertura da tela: são N seguradoras por análise, e uma
--  listagem repetida viraria dezenas de chamadas por minuto.
--
--  É preço de REFERÊNCIA: calculado com os encargos informados na
--  análise. A tela de contratação recalcula com as coberturas que o
--  corretor escolher — quem fecha o valor é ela.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE seguro_analise_pareceres
  ADD COLUMN IF NOT EXISTS precos     JSONB,
  ADD COLUMN IF NOT EXISTS precos_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS precos_erro TEXT;

COMMENT ON COLUMN seguro_analise_pareceres.precos IS
  'Retorno de consultarPrecosApi (planos x formas de pagamento). Preço de REFERÊNCIA com os encargos da análise; a contratação recalcula.';
COMMENT ON COLUMN seguro_analise_pareceres.precos_em IS
  'Quando o preço foi consultado. A tela mostra a data pro corretor saber se vale atualizar.';


-- ── Número da proposta ────────────────────────────────────────────────
-- O painel da corretora mostra "Proposta: 003890" e "Apólice:
-- 1074600192411" como números distintos. A proposta sai na contratação;
-- a apólice, só depois da emissão.
ALTER TABLE seguro_contratacoes
  ADD COLUMN IF NOT EXISTS proposta_numero TEXT;

COMMENT ON COLUMN seguro_contratacoes.proposta_numero IS
  'Número da proposta, anterior à apólice. Identificador enquanto a emissão não sai.';

NOTIFY pgrst, 'reload schema';
