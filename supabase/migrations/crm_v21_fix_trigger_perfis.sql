-- ════════════════════════════════════════════════════════════════════
--  CRM v21 — Fix do trigger de criação automática de perfis
--
--  BUG do crm_v19: trigger inseria em perfis (id) APENAS — se perfis
--  tem coluna NOT NULL sem default (ex: nome, tipo), o INSERT falha,
--  e a transação INTEIRA do auth.users.INSERT é abortada. Resultado:
--  login Google / cadastro novo retornavam "Database error saving new
--  user" e o usuário simplesmente não conseguia entrar.
--
--  Fix:
--    1. Trigger passa a popular nome (de raw_user_meta_data ou email)
--       + tipo='proprietario' + plano='free'.
--    2. Envolto em EXCEPTION WHEN OTHERS — se ainda assim algo der
--       errado, vira WARNING no log e o auth.user é criado normal.
--       A app-side garantirPerfil() pega o resto.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION criar_perfil_para_novo_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Tenta extrair nome de várias fontes (Google login → raw_user_meta_data)
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'nome',
    split_part(NEW.email, '@', 1),
    'Usuário'
  );

  BEGIN
    INSERT INTO perfis (id, nome, tipo, plano)
    VALUES (NEW.id, v_nome, 'proprietario', 'free')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca quebra a criação do usuário no Auth.
    -- A app-side (garantirPerfil) cobre se algo escapar aqui.
    RAISE WARNING 'criar_perfil_para_novo_user falhou para % (%): %',
      NEW.id, NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recria o trigger com a função corrigida
DROP TRIGGER IF EXISTS trg_criar_perfil_novo_user ON auth.users;
CREATE TRIGGER trg_criar_perfil_novo_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION criar_perfil_para_novo_user();

NOTIFY pgrst, 'reload schema';
