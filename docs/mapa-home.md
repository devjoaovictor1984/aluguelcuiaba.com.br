# Mapa da home: o "recarrega sozinho e volta pro topo"

Investigado em 21/11/2026.

## O sintoma

A home carregava, a pessoa rolava a página e ela parecia recarregar e voltava
para o topo.

## As causas (eram duas, somadas)

1. **O posicionamento inicial do mapa contava como "o usuário mexeu".** Ao
   montar, o mapa faz `flyTo`/`fitBounds`. Isso dispara o evento `moveend`
   do Leaflet, que chamava `onBoundsChange` → `router.push('?bbox=...')`.
   Resultado: a home inteira renderizava **de novo no servidor**, com mais
   duas consultas ao banco (lista e mapa) e sem cache (`?bbox` é filtro), e o
   `router.push` rolava a página para o topo.
2. **A roda do mouse dava zoom no mapa.** O mapa do desktop ocupa 55% da
   altura da tela. Rolar a página com o mouse em cima dele dava zoom em vez de
   rolar — outro `moveend`, outro `?bbox`, outro recarregamento.

## O que mudou

`src/components/mapa-imoveis.tsx` e `src/components/mapa-imoveis-wrapper.tsx`:

- Só filtra pela área depois de **interação real**: arrastar, pinça ou os
  botões +/− (`pointerdown` no mapa), ou a roda depois de liberada.
- A roda **só dá zoom depois de clicar no mapa**, e volta a rolar a página
  quando o mouse sai dele.
- A URL troca com `router.replace(..., { scroll: false })`: mover o mapa não
  rola a página nem empilha histórico.

## O cache da home também nunca funcionava

Descoberto junto: `getImoveis` e `getImoveisParaMapa` (`src/lib/supabase/queries.ts`)
só usavam o cache quando `Object.keys(filtros).length === 0`. A home monta
`filtros` com **todas** as chaves, a maioria `undefined`, então a conta nunca
dava zero: **toda visita à home ia direto no banco**, lista e mapa. Agora a
checagem é `semFiltro()` (nenhum valor preenchido). Isso deve aparecer como
menos CPU na Vercel e menos leitura no Supabase — ver a memória
"Vercel / CPU".

## Vale manter o mapa na home?

Sim. Com as correções, o custo fica assim:

- **Servidor:** a lista de pins sai do cache (5 min). Sem o `?bbox` fantasma,
  a página renderiza uma vez por visita.
- **Navegador:** Leaflet (~40 KB gzip) e os tiles carregam só quando o mapa
  aparece na tela (`IntersectionObserver`, ver a memória do Leaflet).
- **Tiles:** vêm do OpenStreetMap, não da Vercel nem do Supabase. A política
  de uso do OSM tolera site pequeno; se o tráfego crescer muito, trocar por
  um provedor (MapTiler, Stadia) é uma linha no `TileLayer`.

Busca por mapa é o que os portais grandes oferecem. Se quiser economizar no
celular, a alternativa é trocar o mapa de 60 % da tela por um botão
"Ver no mapa" — fica registrado como opção, não como pendência.
