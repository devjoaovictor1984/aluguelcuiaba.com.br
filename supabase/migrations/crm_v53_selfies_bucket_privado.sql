-- ════════════════════════════════════════════════════════════════════
--  CRM v53 — Selfies em bucket PRIVADO (LGPD / dado biométrico)
--
--  As selfies de assinatura (vistoria e termo de entrega) eram salvas em
--  buckets públicos, protegidas só pelo caminho UUID. Como são dado
--  biométrico, passam pro bucket privado 'selfies'. A leitura é feita
--  por URL assinada gerada no servidor (rotas de PDF e páginas do painel,
--  onde já há autenticação de admin). Upload e assinatura de URL usam o
--  service-role, então não é preciso policy de leitura pública.
--
--  As colunas selfie_*_url passam a guardar o CAMINHO no bucket (não a
--  URL pública). O código assina sob demanda; valores antigos que ainda
--  forem URL http:// continuam funcionando via fallback.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'selfies',
  'selfies',
  false,                                   -- PRIVADO
  5242880,                                 -- 5MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Sem policy de SELECT público: ninguém lê o bucket direto.
-- (Garante que não sobrou policy antiga liberando leitura anônima.)
DROP POLICY IF EXISTS selfies_select_publico ON storage.objects;

NOTIFY pgrst, 'reload schema';
