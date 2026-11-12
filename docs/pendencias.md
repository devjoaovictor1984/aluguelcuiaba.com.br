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

---

## Acerto manual do IPTU/condomínio já repassado

Levantado em 28/08/2026, junto com a v85.

Até a v85 o repasse ao proprietário era `aluguel − comissão`: IPTU e condomínio
cobrados no boleto sumiam da conta. O caso que apareceu foi o **2026CT016**
(HELDER BARBOSA MACIEL), boleto de R$ 3.800 — R$ 3.500 de aluguel + R$ 300 de
IPTU — repassando R$ 3.150 em vez de R$ 3.450.

A migration corrige as parcelas com `status_repasse = 'pendente'`. As que já
foram repassadas ficam como estão: são histórico, e reescrever repasse já pago
descasaria o sistema do extrato bancário.

**O que fazer:** conferir no contrato quantas parcelas foram repassadas a menor
antes da v85 e acertar a diferença com o proprietário por fora (ou num crédito
na próxima). Só o 2026CT016 tinha encargos no boleto quando isso foi levantado.

**Por que ficou pra depois:** é acerto de caixa entre pessoas, não cálculo — o
sistema não tem como saber se o dono já foi compensado por outra via.

---

## Painel mensal de comissões da seguradora

Pedido em 08/09/2026, para quando a parceria estiver operando de verdade.

Um lugar só, por competência mensal, com o **pró-labore de incêndio e o de
fiança** lado a lado — para conferir o que a corretora deve, contra o que
entrou. Hoje o `/admin/seguros` mostra "base de comissão" dos últimos 30 dias
como referência de negociação, e `seguro_comissoes` (v81) já guarda o
percentual congelado na venda, mas nada disso está fechado por mês nem
separado por produto.

**O que falta antes de construir:**

- A **tabela de comissionamento** da corretora, que segue indefinida (item 2.5
  das pendências da integração). Sem ela o painel exibe estimativa, e
  estimativa em cima de dinheiro a receber é pior que nada.
- O **pró-labore confirmado** do incêndio. Exibimos 20% lidos do painel deles;
  ninguém confirmou se é fixo, por seguradora ou negociado por imobiliária.
- **Pelo menos uma apólice contratada de verdade**, para haver o que conciliar.
  `seguro_comissoes` está vazia: a única apólice emitida (607773, 17/08) é
  anterior à v81, então `registrarComissao()` nunca rodou.
- A **regra de estorno no cancelamento** — se a comissão volta proporcional, o
  painel precisa saber disso antes de dar número por fechado.

**Por que ficou pra depois:** não é tela, é acordo comercial. Construir agora
significa escolher percentuais no lugar da corretora, e o painel passaria a
afirmar valores que ninguém combinou.

---

## Sinistro não aparece fora da tela do contrato

**Onde:** `src/app/(auth)/painel/financeiro/`, `src/app/(auth)/painel/inicio/_components/parcela-acoes-inline.tsx`

A v102 marca na parcela **quem pagou** (`pago_por`), e a tela do contrato mostra
o selo "seguradora", esconde o recibo e soma o total coberto por sinistro. Fora
dali, nada disso aparece:

- No **Financeiro**, dinheiro da seguradora e do locatário entram no mesmo
  total, sem filtro nem coluna que os separe. Para fechar o mês está certo — o
  dinheiro entrou —, mas não dá pra responder "quanto a seguradora cobriu neste
  trimestre" sem abrir contrato por contrato.
- No **Início**, o botão de marcar pagamento não pergunta quem pagou: lança
  sempre como locatário. Em contrato com sinistro aberto isso registra o
  pagador errado, e só dá pra corrigir desfazendo e refazendo pela tela do
  contrato.

**Por que ficou pra depois:** o Início marca pagamento de vários contratos de
uma vez, e cada um teria que ser consultado para saber se tem sinistro aberto —
uma consulta por linha numa tela que hoje faz uma só. Vale resolver junto com o
filtro do Financeiro, que precisa da mesma informação.

---

## Módulo de contratos: o que ficou do "prompt mestre"

Levantado em 11/11/2026, ao fechar as fases 2 (placeholders), 5 (diagramação)
e 3 (biblioteca com código, versão e histórico — v105). Ficou de fora, por
ordem de retorno:

**1. "Das partes" do modelo de LOCAÇÃO ainda usa a qualificação antiga.**
O de administração já usa `{{LOCADOR_QUALIFICACAO}}` (PF/PJ, representante,
e-mail, telefone). O de locação não foi trocado porque a qualificação do
locatário lá leva nascimento, naturalidade e filiação, que a qualificação
nova não monta — trocar perderia dado que a seguradora pede. Fazer: estender
`qualificacao()` em `src/lib/contratos/montar.ts` com esses campos (como
opcionais do locatário) e publicar a cláusula como versão 2 no modelo.

**2. Regras jurídicas automatizadas (etapa 5 do prompt).** O checklist
(`src/lib/contratos/checklist.ts`) cobre partes, garantia, datas e aluguel.
Faltam: garantia em dobro, caução acima de 3 aluguéis, reajuste em menos de
12 meses, multa rescisória não proporcional, encargos extraordinários de
condomínio no locatário. Cada uma vira item do checklist com a cláusula
apontada.

**3. Aluguel progressivo e encargos com base de cálculo no contrato de
locação.** O de locação já tem `taxa_admin_base` (v85); falta o valor por
período (meses 1–12, 13–24…) e as cláusulas condicionais correspondentes.

**4. Biblioteca de aditivos com regras (etapa 6).** Os aditivos já têm
cláusulas (v96) e contrato originário (v95); falta o catálogo por tipo de
alteração com a cláusula de ratificação gerada.

**5. Editor em etapas (etapa 9).** O editor atual faz tudo numa tela. O
fluxo em 9 passos é reorganização de interface, sem regra nova.

**Por que ficou pra depois:** cada item é uma fase própria e os textos
jurídicos novos pedem revisão humana antes de virarem modelo.

---

## Usuário autorizado: o que ficou para depois (v106)

Feito em 12/11/2026; ver `docs/contratos-participantes.md`. Ficou de fora de
propósito:

**1. Assinatura eletrônica separada para a entrega das chaves.** Hoje o termo
de entrega vai anexo ao contrato e é assinado junto, e por isso fala no futuro
quando a data ainda não chegou. Uma assinatura própria no dia da entrega daria
a data exata sem depender do registro manual de `chaves_entregues_em`.

**2. Feriados no prazo da troca de titularidade.** `somarDiasUteis()` só pula
fim de semana. Para Cuiabá, faltam os feriados nacionais, estaduais e
municipais.

**3. Os 12 campos de responsabilidade do prompt original não foram criados.**
`responsavel_aluguel`, `responsavel_seguro_fianca` etc. já são papéis
(`inquilino_solidario`, `responsavel_seguro`). Duplicar abriria combinações
contraditórias. Só entraram as contas de consumo e a atividade.

**4. Cláusulas do usuário autorizado não aparecem no editor.** São sintéticas
(montadas no PDF), como a do responsável pelo seguro. Para editar o texto de
um contrato específico, hoje é preciso mudar o código. Se precisar, levar para
a biblioteca como cláusula condicional.
