-- ─────────────────────────────────────────────────────────────────────
-- v101 · Foto do item do inventário
--
-- POR QUE: o inventário da v46 descreve o bem em texto ("Geladeira,
-- Brastemp, branca, bom"). Na devolução isso vira discussão: qual
-- geladeira, com qual amassado, de quem era. Uma foto por item, anexada
-- ao contrato que as partes assinam, encerra a discussão antes dela.
--
-- UMA foto por item, e não uma galeria: o anexo entra no PDF que vai pro
-- fluxo de assinatura (selfie + OTP + certificado). Vinte itens com três
-- fotos cada viram um arquivo que não sobe, não chega por e-mail e não
-- assina. Aqui a foto IDENTIFICA o bem; documentar avaria continua sendo
-- trabalho da vistoria, que tem galeria por item e por cômodo.
--
-- Bucket PRIVADO, ao contrário de 'vistorias-fotos', que é público: a
-- foto mostra o interior da casa de alguém. O PDF recebe signed URL na
-- hora de montar, igual a v97 fez com as apólices.
--
-- Bucket: criar no painel Supabase → Storage → New bucket
--   Nome: contratos-inventario   ·   Public: OFF
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contrato_inventario_itens
  ADD COLUMN IF NOT EXISTS foto_path TEXT;

COMMENT ON COLUMN contrato_inventario_itens.foto_path IS
  'Caminho no bucket privado contratos-inventario. Uma foto por item. Exibir sempre por signed URL — nunca URL pública.';

NOTIFY pgrst, 'reload schema';
