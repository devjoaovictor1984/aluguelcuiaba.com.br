-- ════════════════════════════════════════════════════════════════════
--  CRM v19 — Garante row em perfis pra todo usuário de auth.users
--
--  Sintoma: usuário criado direto via SQL (ou registrado antes do trigger
--  de criação de perfil existir) fica em auth.users sem row em perfis.
--  Consequência: UPDATE na tabela perfis afeta 0 rows silenciosamente —
--  usuário "salva" config do recibo mas nada persiste.
--
--  Solução:
--    1. Backfill: cria perfis pra todos os auth.users sem perfil.
--    2. Trigger: novo auth.users.insert dispara INSERT em perfis.
-- ════════════════════════════════════════════════════════════════════

-- 1. BACKFILL: cria perfil pra quem não tem
INSERT INTO perfis (id)
SELECT u.id
FROM auth.users u
LEFT JOIN perfis p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. Trigger pra criar perfil sempre que aparecer auth.users novo
CREATE OR REPLACE FUNCTION criar_perfil_para_novo_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_criar_perfil_novo_user ON auth.users;
CREATE TRIGGER trg_criar_perfil_novo_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION criar_perfil_para_novo_user();

NOTIFY pgrst, 'reload schema';
