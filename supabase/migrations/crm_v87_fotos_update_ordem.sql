-- ─────────────────────────────────────────────────────────────────────
-- v87 · Reordenar fotos: política de UPDATE em `fotos`
--
-- POR QUE: a estrela de "foto destaque" na edição do anúncio reordenava
-- só o estado da tela. O submit nunca gravava `ordem` nem `principal` das
-- fotos que já existiam, então o clique não tinha efeito nenhum depois de
-- salvar. O formulário passou a gravar — e para gravar precisa poder dar
-- UPDATE em `fotos`, coisa que nenhum código do app fazia até agora.
--
-- O `fotos` sempre teve INSERT e DELETE pelo dono do imóvel (é o que o
-- formulário já usava). Se a política de UPDATE já existir com outro nome,
-- esta aqui apenas soma — RLS é permissiva: basta UMA política liberar.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fotos_update_dono ON fotos;
CREATE POLICY fotos_update_dono ON fotos
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = fotos.imovel_id AND i.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = fotos.imovel_id AND i.user_id = auth.uid()
  ));

COMMENT ON POLICY fotos_update_dono ON fotos IS
  'Dono do imóvel reordena as próprias fotos (ordem/principal) pela tela de edição.';

-- Consulta de conferência — as leituras do site já ordenam por `ordem`,
-- então uma foto sem ordem definida cai no fim de forma imprevisível.
-- Rode depois de aplicar; o esperado é ZERO linhas.
--
--   SELECT imovel_id, count(*) FILTER (WHERE principal) AS capas, count(*) AS total
--   FROM fotos GROUP BY imovel_id HAVING count(*) FILTER (WHERE principal) <> 1;
