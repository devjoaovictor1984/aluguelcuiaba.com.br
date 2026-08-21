-- ════════════════════════════════════════════════════════════════════
--  CRM v83 — Código público de validação do contrato assinado
--
--  O certificado (v61) já traz a trilha completa e o hash SHA-256, mas
--  tudo isso só prova alguma coisa pra quem TEM o arquivo. Quem recebe
--  uma via impressa — cartório, banco, o próprio inquilino — não tinha
--  como conferir se aquele papel corresponde a um contrato realmente
--  assinado aqui.
--
--  Agora cada processo concluído ganha um código curto, carimbado no
--  rodapé de todas as páginas do PDF final junto de um QR. Batendo o
--  código em /validar, qualquer pessoa vê título, data e quem assinou.
--
--  A página pública NÃO expõe selfie, IP, e-mail nem geolocalização:
--  isso é trilha de auditoria (LGPD) e continua só no certificado, que
--  vai pra quem é parte no contrato.
--
--  O código é gerado na conclusão. Processos concluídos antes desta
--  migração recebem o código na primeira vez que a via final for
--  gerada (backfill preguiçoso no código da rota).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_assinaturas
  ADD COLUMN IF NOT EXISTS codigo_validacao TEXT;

COMMENT ON COLUMN contrato_assinaturas.codigo_validacao IS
  'Código público (XXXX-XXXX-XXXX) carimbado no PDF final. Consultável em /validar sem login. Nulo enquanto o processo não conclui.';

-- Índice único parcial: o código é a chave de consulta pública, não pode
-- repetir; nulo (processo em andamento) fica de fora.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assinaturas_codigo_validacao
  ON contrato_assinaturas(codigo_validacao)
  WHERE codigo_validacao IS NOT NULL;

NOTIFY pgrst, 'reload schema';
