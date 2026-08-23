# Pendências conhecidas

Coisas que a gente **já sabe** que precisam de ajuste, mas decidiu não fazer na
hora. Cada item diz o que está errado, onde, e por que ficou pra depois — pra
quem pegar não precisar redescobrir o problema.

Item resolvido sai daqui e vira commit.

---

## Abas de status do `/admin/imoveis` não cobrem a base

**Onde:** `src/app/admin/imoveis/page.tsx`

As abas de filtro são `todos · ativo · pausado · expirado · rascunho`. Só que a
distribuição real dos imóveis (22/08/2026) é:

| status | imóveis |
| --- | --- |
| alugado | 17 |
| ativo | 8 |
| expirado | 1 |
| pausado | 0 |
| rascunho | 0 |

Ou seja: **`alugado` é 65% da base e não tem aba**, enquanto `pausado` e
`rascunho` têm aba e nunca devolvem nada. Quem usa o filtro vê três abas vazias
e não alcança o maior grupo pelo caminho normal.

Junto disso, o `STATUS_COR` **dessa página** não tem entrada para `alugado`
(o do dashboard, em `src/app/admin/page.tsx`, tem: `bg-teal-100 text-teal-700`).
Como o código faz `STATUS_COR[im.status] ?? ''`, esses imóveis aparecem com a
etiqueta sem cor nenhuma — nas duas listagens, desktop e mobile.

**O que fazer:** acrescentar `alugado` às `TABS` e ao `STATUS_COR` da página, e
tirar `pausado`/`rascunho` das abas (ou deixá-las só quando houver registro).

**Por que ficou pra depois:** é cosmético, não impede nada — o filtro por
`?status=alugado` na URL já funciona hoje, só não tem botão. Surgiu enquanto se
investigava outra coisa (um imóvel expirado que parecia sumido da lista, e não
estava: era de outro anunciante, o admin estava certo).

---

## Discutido e adiado no módulo de assinatura

Levantado em 21–22/08/2026, quando entraram o código de validação público (v83)
e a via final congelada (v84). Nenhum é urgente; a ordem abaixo é a de melhor
retorno pelo esforço.

**1. OTP também por WhatsApp/SMS.** Hoje o código de confirmação só vai por
e-mail, embora o celular do signatário já seja coletado e apareça no
certificado. Dois canais independentes é o que mais reforça a prova de autoria
por real gasto, e resolve o caso comum de e-mail compartilhado entre o casal.

**2. Liveness + conferência com documento.** A selfie da assinatura é uma foto
qualquer: não prova que havia uma pessoa viva na frente da câmera nem é
comparada com documento algum. É essa diferença que separa a assinatura
"simples" da **avançada** (Lei 14.063/2020). Tem custo por verificação (idwall,
Unico, Serpro) — vale quando a conversa com a seguradora amadurecer, porque é o
tipo de coisa que **eles** vão perguntar.

**3. Carimbo de tempo de terceiro (RFC 3161).** O `assinado_em` é o relógio do
nosso servidor. Um carimbo de autoridade de tempo torna a data oponível a
terceiros. Só faz sentido depois da v84, porque o que se carimba é o hash do
arquivo congelado — que agora existe.

**4. Assinatura desenhada ainda em base64.** A selfie foi pro bucket privado na
v82; a imagem da assinatura continua em `assinatura_b64` (TEXT) no banco, com os
mesmos problemas de peso em dump e falta de expiração de acesso.
