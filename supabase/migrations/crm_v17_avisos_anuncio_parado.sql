-- ════════════════════════════════════════════════════════════════════
--  CRM v17 — Avisos de anúncio parado (30d / 60d)
--  Quando o anunciante fica sem atualizar o imóvel por 30 ou 60 dias,
--  dispara email + push + banner no painel pra ele dar uma renovada.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS aviso_30d_em            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_60d_em            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avisos_silenciados_ate  TIMESTAMPTZ;

-- Quando QUALQUER edição "interessante" do anunciante acontece (mas o
-- update NÃO está alterando as colunas de aviso), reseta os timestamps
-- pra que o ciclo recomece. Sem isso, depois de receber o aviso de 30d
-- a flag fica setada e nunca mais dispararia.
CREATE OR REPLACE FUNCTION reset_avisos_anuncio()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aviso_30d_em := NULL;
  NEW.aviso_60d_em := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_avisos_anuncio ON imoveis;
CREATE TRIGGER trg_reset_avisos_anuncio
  BEFORE UPDATE ON imoveis
  FOR EACH ROW
  WHEN (
    -- O cron muda só os campos de aviso → não queremos resetar nesse caso.
    OLD.aviso_30d_em IS NOT DISTINCT FROM NEW.aviso_30d_em
    AND OLD.aviso_60d_em IS NOT DISTINCT FROM NEW.aviso_60d_em
    AND OLD.avisos_silenciados_ate IS NOT DISTINCT FROM NEW.avisos_silenciados_ate
    -- Mas se alguma coluna "real" mudou, considera edição → reseta.
    AND (
      OLD.titulo            IS DISTINCT FROM NEW.titulo
      OR OLD.descricao      IS DISTINCT FROM NEW.descricao
      OR OLD.preco          IS DISTINCT FROM NEW.preco
      OR OLD.status         IS DISTINCT FROM NEW.status
      OR OLD.expira_em      IS DISTINCT FROM NEW.expira_em
      OR OLD.taxa_condominio IS DISTINCT FROM NEW.taxa_condominio
      OR OLD.iptu           IS DISTINCT FROM NEW.iptu
      OR OLD.quartos        IS DISTINCT FROM NEW.quartos
      OR OLD.bairro_id      IS DISTINCT FROM NEW.bairro_id
    )
  )
  EXECUTE FUNCTION reset_avisos_anuncio();

CREATE INDEX IF NOT EXISTS imoveis_aviso_30d_pendente_idx
  ON imoveis (updated_at)
  WHERE status = 'ativo' AND aviso_30d_em IS NULL;

NOTIFY pgrst, 'reload schema';
