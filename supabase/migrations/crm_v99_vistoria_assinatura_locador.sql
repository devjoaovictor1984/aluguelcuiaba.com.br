-- ─────────────────────────────────────────────────────────────────────
-- v99 · Assinatura da administradora na vistoria
--
-- POR QUE: a vistoria tinha uma assinatura só, a do inquilino, e o ciclo
-- fechava ali. Mas é ele quem registra ressalvas item a item ("parede
-- riscada", "torneira pingando") — então o laudo ficava assinado apenas
-- pelo lado que fez as ressalvas, sem ninguém da administradora
-- confirmar que as recebeu e está de acordo. Na saída isso pesa mais
-- ainda, porque é o laudo de entrada que decide quem paga o reparo.
--
-- O termo de entrega de chaves (v51/v72) já assina dos dois lados, com
-- ordem livre. Aqui é o mesmo desenho — a vistoria é que tinha ficado
-- de fora.
--
-- STATUS, e por que não se mexe no significado de 'assinada':
--   enviada           → link com o inquilino, ninguém assinou
--   assinada          → o INQUILINO assinou (significado de sempre)
--   assinada_locador  → só a administradora assinou
--   concluida         → os dois assinaram
--
-- Vistoria antiga em 'assinada' continua querendo dizer exatamente o que
-- sempre quis. Ela fica com a contra-assinatura pendente, que é a
-- verdade: ninguém da administradora assinou aquilo. Reinterpretar
-- 'assinada' como "completa" seria dar por assinado o que não foi.
--
-- Idempotente: pode rodar mais de uma vez.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS assinatura_locador_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_locador_url     TEXT,
  ADD COLUMN IF NOT EXISTS assinada_locador_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinada_locador_ip    TEXT;

-- O CHECK do status nasceu inline na v20, então o nome é o que o Postgres
-- gerou: acha pelo conteúdo, como na v94.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'vistorias'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE vistorias DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE vistorias
  ADD CONSTRAINT vistorias_status_check
  CHECK (status IN ('rascunho','enviada','assinada','assinada_locador','concluida','recusada'));

COMMENT ON COLUMN vistorias.assinatura_locador_url IS
  'Assinatura desenhada da administradora. Bucket público vistorias-fotos, como a do inquilino.';
COMMENT ON COLUMN vistorias.selfie_locador_url IS
  'CAMINHO da selfie no bucket privado (não URL) — exibir por signed URL. Opcional deste lado.';
COMMENT ON COLUMN vistorias.status IS
  'rascunho | enviada | assinada (inquilino) | assinada_locador | concluida (ambos) | recusada.';

NOTIFY pgrst, 'reload schema';
