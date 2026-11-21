# Painel — Meus anúncios

Reformulado em 21/11/2026. Antes o menu tinha **"Meus anúncios"** (que abria o
resumo da conta, `/painel`) e **"Listar anúncios"** (a lista de verdade) — dois
nomes para a mesma ideia. A lista também carregava todos os anúncios com todas
as fotos e filtrava em memória, sem busca nem paginação.

## Onde fica cada coisa

| Menu | Rota | O que é |
| --- | --- | --- |
| Visão geral | `/painel` | perfil, plano, alertas de anúncio parado, atalho do CRM |
| Meus anúncios | `/painel/anuncios` | a lista: busca, filtros, ordenação, paginação, ações |
| Novo anúncio | `/painel/anuncios/novo` | cadastro (checa limite do plano) |
| Portais | `/painel/anuncios/portais` | OLX · ZAP · Viva Real — ver `docs/integracoes/portais/` |
| Administração → Painel admin | `/admin` | **só admin** |
| Administração → Todos os anúncios | `/painel/anuncios?escopo=todos` | **só admin** |

Publicar e salvar agora voltam para `/painel/anuncios` com o aviso
(`?publicado=1`, `?atualizado=1`, `?excluido=1`).

## A lista (`/painel/anuncios`)

Tudo que filtra fica na URL, então dá para recarregar, voltar e mandar o link:

| Parâmetro | Valores |
| --- | --- |
| `q` | busca em título, endereço resumido, condomínio, slug e **nome do bairro** |
| `status` | `ativo` · `alugado` · `pausado` · `expirado` · `rascunho` (ausente = todos) |
| `ordem` | `recentes` (padrão) · `atualizados` · `antigos` · `preco_maior` · `preco_menor` · `visitas` · `expira` |
| `pagina` | 20 por página, paginação feita no banco (`range` + `count: exact`) |
| `escopo` | `todos` — **ignorado para quem não é admin** |

- **Status efetivo:** um `ativo` com `expira_em` vencido aparece como
  *expirado* (o cron que troca o status pode não ter passado ainda). As abas
  contam do mesmo jeito que filtram.
- Abas sem nenhum anúncio somem (menos a selecionada).
- A busca tira `, ( ) % * \` do texto: são sintaxe do `.or()` do PostgREST.
- Os indicadores do topo (No ar, Alugados, A renovar, Visitas) são atalhos
  de filtro e respeitam a busca e o escopo.

## Ações e quem pode fazer

`src/app/(auth)/painel/anuncios/actions-crud.ts`. A permissão é conferida
**no servidor** (`acessoAnuncio`): esconder o botão não protege nada.

| Ação | Dono | Admin | Outros |
| --- | --- | --- | --- |
| Editar (`/painel/anuncios/[id]/editar`) | sim | sim | não |
| Marcar alugado / pausar / reativar / publicar rascunho | sim | sim | não |
| Renovar +30 dias | sim | sim | não |
| Excluir | sim | sim | não |
| Ligar no portal / tipo de destaque | sim | sim | não |
| Ver anúncios de todos | não | sim | não |

O dono age com o cliente da sessão (RLS por cima); o admin, com o cliente de
serviço. Marcar como alugado grava `data_alugado` (é o que conta os 30 dias da
faixa "alugado" na vitrine).

A exclusão é **definitiva**, com confirmação na própria linha. Contratos,
administrações e seguros ligados ao imóvel ficam (FK `ON DELETE SET NULL`).
A tela de edição também exclui pela mesma action.

## Arquivos

- `page.tsx` — consulta, contagens, cabeçalho, abas, lista
- `_components/barra-anuncios.tsx` — busca (debounce 350 ms), ordenação, escopo
- `_components/anuncio-linha.tsx` — uma linha, menu "⋯", confirmação de exclusão
- `_components/paginacao.tsx` — `1 … 4 5 [6] 7 8 … 20`
- `actions-crud.ts` — status, renovar, excluir, portais

O `imovel-card.tsx` antigo e as actions `renovarAnuncio`/`mudarStatusImovel`
de `painel/actions.ts` foram removidos (só a lista antiga usava).
