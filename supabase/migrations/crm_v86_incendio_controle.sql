-- v86 — Campo "Controle" nas cotações de seguro incêndio
--
-- O painel da Maximiza tem, junto do endereço, um campo livre chamado
-- "Controle / CTRL-PASTA": a referência interna que a imobiliária usa para
-- achar a apólice no arquivo dela (número de pasta, código do contrato,
-- o que for). Não vai para a seguradora — é nota nossa.
--
-- Sem ele, quem tem apólice em dois sistemas não consegue casar os dois:
-- o `codigo_seguro` da Maximiza não significa nada no arquivo da
-- imobiliária, e o nome do inquilino se repete entre contratos.

ALTER TABLE seguro_incendio_apolices
  ADD COLUMN IF NOT EXISTS controle TEXT;

COMMENT ON COLUMN seguro_incendio_apolices.controle IS
  'Referência livre da imobiliária ("Controle / CTRL-PASTA" no painel da corretora). Uso interno: não é enviada à seguradora.';

-- Sem índice de propósito: a busca da listagem filtra em memória, sobre a
-- página já carregada (inquilino e endereço vivem em JSONB, e o filtro
-- ficou do lado do Node por isso). O controle entra nesse mesmo caminho.
-- Se um dia a busca descer pro banco, o índice vem junto com ela.
