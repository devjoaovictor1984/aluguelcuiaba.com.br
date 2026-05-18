-- ════════════════════════════════════════════════════════════════════
--  CRM v9 — Sync imóveis ↔ contratos (corrige imóveis antigos)
--  Imóveis cadastrados antes do CRM v2 podem ter ficado fora do
--  trigger de sincronização. Este script força a consistência:
--    1. Reinstala o trigger sincronizar_status_imovel (idempotente).
--    2. Backfill: para todo imóvel com contrato ATIVO, marca como
--       'alugado' e preenche data_alugado a partir do contrato.
--    3. Backfill reverso: imóvel 'alugado' sem contrato ativo volta
--       para 'ativo' (limpa estado inconsistente).
-- ════════════════════════════════════════════════════════════════════

-- 1. Garante a função e o trigger de sincronização (idempotente)
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
  ELSIF (NOT tem_ativo) AND status_atual = 'alugado' THEN
    UPDATE imoveis
       SET status = 'ativo',
           data_alugado = NULL
     WHERE id = imovel_uuid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contratos_sync_imovel ON contratos_locacao;
CREATE TRIGGER trg_contratos_sync_imovel
  AFTER INSERT OR UPDATE OF status, imovel_id, deleted_at OR DELETE ON contratos_locacao
  FOR EACH ROW
  EXECUTE FUNCTION sincronizar_status_imovel();


-- 2. BACKFILL: imóveis com contrato ativo viram 'alugado'.
--    Usa NOW() pra data_alugado para que a janela pública de 30 dias
--    comece a contar a partir do sync, e não da data antiga do contrato
--    (que poderia já estar fora da janela).
WITH contratos_ativos AS (
  SELECT DISTINCT ON (imovel_id) imovel_id
  FROM contratos_locacao
  WHERE status = 'ativo'
    AND deleted_at IS NULL
    AND imovel_id IS NOT NULL
)
UPDATE imoveis i
   SET status = 'alugado',
       data_alugado = COALESCE(i.data_alugado, NOW())
  FROM contratos_ativos ca
 WHERE i.id = ca.imovel_id
   AND i.status <> 'alugado';


-- 3. BACKFILL reverso: imóveis 'alugado' sem contrato ativo voltam pra 'ativo'
UPDATE imoveis i
   SET status = 'ativo',
       data_alugado = NULL
 WHERE i.status = 'alugado'
   AND NOT EXISTS (
     SELECT 1 FROM contratos_locacao c
      WHERE c.imovel_id = i.id
        AND c.status = 'ativo'
        AND c.deleted_at IS NULL
   );


NOTIFY pgrst, 'reload schema';
