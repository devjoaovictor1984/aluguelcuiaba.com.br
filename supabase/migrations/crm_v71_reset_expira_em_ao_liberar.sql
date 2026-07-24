-- ════════════════════════════════════════════════════════════════════
--  CRM v71 — Renova expira_em quando o imóvel é liberado de um contrato
--
--  Sintoma: imóvel cujo contrato foi encerrado/rescindido volta pra
--  'ativo' (via trigger sincronizar_status_imovel), MAS com o expira_em
--  antigo (a validade de 30d do anúncio original, que já venceu faz
--  tempo). Consequências:
--    1. No painel aparece "Expirado" logo de cara.
--    2. O cron /api/renovar rebaixa status='ativo' → 'expirado' e o
--       imóvel some do site público.
--
--  Correção: ao liberar o imóvel (não há mais contrato ativo), o trigger
--  passa a dar 30 dias novos de vitrine — mesmo comportamento do botão
--  "Renovar +30 dias". Reseta também aviso_enviado pra o ciclo de avisos
--  recomeçar.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sincronizar_status_imovel()
RETURNS TRIGGER AS $$
DECLARE
  imovel_uuid UUID;
  tem_ativo BOOLEAN;
  status_atual TEXT;
  data_inicio_ativo DATE;
BEGIN
  imovel_uuid := COALESCE(NEW.imovel_id, OLD.imovel_id);
  IF imovel_uuid IS NULL THEN RETURN NULL; END IF;

  SELECT EXISTS(
    SELECT 1 FROM contratos_locacao
    WHERE imovel_id = imovel_uuid
      AND status = 'ativo'
      AND deleted_at IS NULL
  ) INTO tem_ativo;

  SELECT status INTO status_atual FROM imoveis WHERE id = imovel_uuid;

  IF tem_ativo AND status_atual <> 'alugado' THEN
    SELECT MIN(data_inicio) INTO data_inicio_ativo
    FROM contratos_locacao
    WHERE imovel_id = imovel_uuid
      AND status = 'ativo'
      AND deleted_at IS NULL;
    UPDATE imoveis
       SET status = 'alugado',
           data_alugado = COALESCE(data_alugado, data_inicio_ativo::timestamptz, NOW())
     WHERE id = imovel_uuid;
  ELSIF (NOT tem_ativo) AND status_atual IN ('alugado', 'expirado') THEN
    -- Imóvel volta pra vitrine com 30 dias novos, senão entra vencido
    -- e o cron o rebaixa pra 'expirado' de novo.
    UPDATE imoveis
       SET status = 'ativo',
           data_alugado = NULL,
           expira_em = NOW() + INTERVAL '30 days',
           aviso_enviado = false
     WHERE id = imovel_uuid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: imóveis já presos nesse estado — sem contrato ativo, mas com
-- ao menos um contrato encerrado/rescindido, e atualmente 'expirado' ou
-- 'ativo' já vencido. Devolve 30 dias de vitrine.
UPDATE imoveis i
   SET status = 'ativo',
       data_alugado = NULL,
       expira_em = NOW() + INTERVAL '30 days',
       aviso_enviado = false
 WHERE (
         i.status = 'expirado'
         OR (i.status = 'ativo' AND i.expira_em < NOW())
       )
   AND EXISTS (
     SELECT 1 FROM contratos_locacao c
      WHERE c.imovel_id = i.id
        AND c.status IN ('encerrado', 'rescindido')
        AND c.deleted_at IS NULL
   )
   AND NOT EXISTS (
     SELECT 1 FROM contratos_locacao c
      WHERE c.imovel_id = i.id
        AND c.status = 'ativo'
        AND c.deleted_at IS NULL
   );

NOTIFY pgrst, 'reload schema';
