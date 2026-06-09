-- ════════════════════════════════════════════════════════════════════
--  CRM v54 — Rate limiting durável (tabela + RPC atômica)
--
--  Serverless não tem memória compartilhada entre instâncias, então o
--  controle de taxa vive no banco. A função rate_limit_hit incrementa
--  um contador por chave dentro de uma janela deslizante e diz se a
--  requisição está dentro do limite. Usada pelas rotas/actions públicas
--  (geocode, contadores de view, assinatura por token).
--
--  Login/cadastro/reset NÃO passam aqui — são client→Supabase direto;
--  o limite deles é configurado no dashboard (Auth → Rate Limits).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limits (
  chave          TEXT PRIMARY KEY,
  janela_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
  contador       INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: só o service-role (rpc abaixo) toca a tabela.

-- Retorna TRUE se a requisição está dentro do limite, FALSE se estourou.
-- Janela deslizante simples: ao expirar a janela, zera o contador.
CREATE OR REPLACE FUNCTION rate_limit_hit(p_chave TEXT, p_limite INT, p_janela_seg INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cont INT;
BEGIN
  INSERT INTO rate_limits AS r (chave, janela_inicio, contador)
  VALUES (p_chave, now(), 1)
  ON CONFLICT (chave) DO UPDATE
    SET contador = CASE
          WHEN r.janela_inicio < now() - make_interval(secs => p_janela_seg) THEN 1
          ELSE r.contador + 1 END,
        janela_inicio = CASE
          WHEN r.janela_inicio < now() - make_interval(secs => p_janela_seg) THEN now()
          ELSE r.janela_inicio END
  RETURNING r.contador INTO v_cont;

  RETURN v_cont <= p_limite;
END;
$$;

NOTIFY pgrst, 'reload schema';
