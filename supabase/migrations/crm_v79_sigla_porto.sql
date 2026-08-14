-- ─────────────────────────────────────────────────────────────────────
--  v79 — sigla da Porto Seguro: 'porto' → 'por'
--
--  A documentação da Maximiza se contradizia (ora "porto", ora "por") e
--  tínhamos escolhido 'porto' como canônico. Com a credencial de API em
--  mãos (14/08/2026), a API viva respondeu:
--
--    GET /apiFiancaAnalise/seguradorasAnalise
--    → [{"seguradora":"Porto","sigla":"por","analiseReduzida":"sim"}, …]
--
--  Canônico passa a ser 'por'. Sem esta correção, os pareceres gravados
--  antes ficariam órfãos: o webhook grava 'por', o banco tem 'porto', e o
--  UNIQUE (analise_id, seguradora_sigla) criaria DUAS linhas da Porto na
--  mesma análise — uma parada no status antigo, outra viva.
--
--  Idempotente e seguro de rodar duas vezes.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- Se por algum acaso já existir a linha 'por' na mesma análise, a antiga
-- 'porto' é a obsoleta (foi gravada antes da correção): descarta.
DELETE FROM seguro_analise_pareceres a
 WHERE a.seguradora_sigla = 'porto'
   AND EXISTS (
     SELECT 1 FROM seguro_analise_pareceres b
      WHERE b.analise_id = a.analise_id
        AND b.seguradora_sigla = 'por'
   );

UPDATE seguro_analise_pareceres
   SET seguradora_sigla = 'por'
 WHERE seguradora_sigla = 'porto';

-- Mesma lógica nos arquivos: UNIQUE (analise_id, seguradora_sigla, codigo_tipo).
DELETE FROM seguro_arquivos a
 WHERE a.seguradora_sigla = 'porto'
   AND EXISTS (
     SELECT 1 FROM seguro_arquivos b
      WHERE b.analise_id = a.analise_id
        AND b.seguradora_sigla = 'por'
        AND b.codigo_tipo = a.codigo_tipo
   );

UPDATE seguro_arquivos
   SET seguradora_sigla = 'por'
 WHERE seguradora_sigla = 'porto';

-- Contratações não têm unique por sigla; basta renomear.
UPDATE seguro_contratacoes
   SET seguradora_sigla = 'por'
 WHERE seguradora_sigla = 'porto';

COMMENT ON COLUMN seguro_analise_pareceres.seguradora_sigla IS
  'Sigla como a API devolve: ''too'', ''tok'', ''ptc'', ''por''. A Porto é ''por'' — confirmado contra /seguradorasAnalise em 14/08/2026.';

COMMIT;
