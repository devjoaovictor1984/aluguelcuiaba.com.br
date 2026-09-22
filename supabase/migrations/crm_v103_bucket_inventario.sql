-- ─────────────────────────────────────────────────────────────────────
-- v103 · Bucket das fotos do inventário (o que a v101 pedia no braço)
--
-- POR QUE: a v101 mandava criar `contratos-inventario` clicando no painel
-- do Supabase. Quem não clicou recebe "Bucket not found" na cara, no meio
-- do cadastro de um item — e o erro não diz o que fazer. Passo manual em
-- migration é passo esquecido: o bucket nasce aqui, junto do resto.
--
-- PRIVADO: a foto mostra o interior da casa de alguém. Quem exibe pede
-- signed URL — tela e PDF —, nunca URL pública.
--
-- O limite de 3MB é rede de segurança, não a regra: o navegador comprime
-- pra ~250KB antes de subir (PERFIL_FOTO_INVENTARIO). Ele existe pro caso
-- de a compressão falhar em algum aparelho e mandar o arquivo original.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos-inventario',
  'contratos-inventario',
  FALSE,
  3145728,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public            = FALSE,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Sem policies de storage: quem lê e escreve é o admin client (service
-- role), que passa por fora do RLS. A dona do acesso é a action, que
-- confere o contrato do usuário antes de qualquer escrita — o mesmo
-- desenho de 'contratos-docs' (v97).

NOTIFY pgrst, 'reload schema';
