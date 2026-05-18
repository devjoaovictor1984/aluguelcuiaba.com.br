-- ════════════════════════════════════════════════════════════════════
--  CRM v12 — Reset da janela "alugado" pros imóveis backfilled
--
--  Sintoma: imóvel ficou status='alugado' depois do v9, mas a faixa
--  ALUGADO não aparece pro visitante público porque data_alugado foi
--  preenchido com data_inicio do contrato (que pode ser antiga).
--
--  Regra do filtro público: status='alugado' AND data_alugado > NOW()-30d.
--
--  Este script bumpa data_alugado pra agora em imóveis que estão
--  marcados como alugado mas fora da janela — assim o anunciante ganha
--  30 dias de exposição contados a partir de agora.
-- ════════════════════════════════════════════════════════════════════

UPDATE imoveis
   SET data_alugado = NOW()
 WHERE status = 'alugado'
   AND (data_alugado IS NULL OR data_alugado < NOW() - INTERVAL '30 days');

NOTIFY pgrst, 'reload schema';
