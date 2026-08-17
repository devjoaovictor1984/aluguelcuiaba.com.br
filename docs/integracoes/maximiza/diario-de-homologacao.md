# Diário de homologação — Maximiza

Registro do que foi testado contra a API viva, o que quebrou, o que virou
conserto e o que ficou dependendo da corretora. Serve para não redescobrir a
mesma coisa duas vezes e para saber, a qualquer momento, em que pé está.

**Como ler:** cada entrada tem o que foi medido (fato) e o que se fez (decisão).
Fato sem medição não entra aqui — se está escrito, foi observado contra a API.

**Convenções:** ✅ resolvido · ⏳ aguardando a corretora · ⚠️ aberto do nosso lado

---

## Estado atual — 17/08/2026 (fim do dia)

| Frente | Onde está |
|---|---|
| Fiança — análise | ✅ funciona; para em pré-aprovado, como a regra deles prevê |
| Fiança — biometria | ⏳ sem caminho: o link só vem por webhook, que não está cadastrado |
| Fiança — contratação | ⏳ bloqueada pela biometria; nunca exercitada |
| Incêndio — cálculo | ✅ funciona na Alfa e na Porto |
| Incêndio — contratação | ✅ apólice 607773 emitida em homologação |
| Incêndio — documentos | ✅ certificado e proposta; boleto sai depois do lote |
| Incêndio — cancelamento | ⚠️ único passo do fluxo que nunca rodou |
| Comissões | ✅ registradas na venda; percentuais dependem da corretora |
| Modelo comercial | ⏳ nada definido — ver `perguntas-pendentes.md`, bloco 2 |

**Ambiente:** homologação (`MAXIMIZA_AMBIENTE=2`), local e na Vercel.
**CNPJ de teste:** `10.961.528/0001-80` (MAXIMIZA IMOB TEMP - DF).
**Habilitações do CNPJ de teste:** só `porto_fianca`; incêndio tem Porto e Alfa.

---

## 13/08/2026 — a credencial chegou

Credencial de homologação recebida por WhatsApp. Autentica em
`POST auth.api.seguro.imb.br/auth` com HTTP 201.

**Medido:** o JWT dura **1800s (30 min)**, não os prazos longos que a
documentação sugere. Payload: `{"id":"101","typeUser":1}`.

**Decisão:** o cache do token renova 5 minutos antes do `exp` lido do próprio
JWT, nunca de constante nossa.

---

## 14/08/2026 — o catálogo, e o que a doc errava

**Medido:** `seguradorasAnalise` devolve Too (`too`), Tokio (`tok`),
Pottencial (`ptc`) e Porto (`por`). A sigla da Porto é **`por`** — a
documentação alternava entre `por` e `porto`.

**Medido:** `consultarImobiliaria` traz flags de habilitação por seguradora
(`porto_fianca`, `too_fianca`…) que **não constam na documentação**.

**Decisão:** `por` virou valor canônico (migration v79 renomeou as linhas
antigas); continuamos aceitando `porto` na entrada.

---

## 15/08/2026 — primeiro fluxo de fiança ponta a ponta

Análises 215527 (Porto) e 215528 (Too), em homologação.

**Medido — o tipo do `codigoStatus` muda por endpoint:** número no
`transmitirAnalise`, string no `GET /apiFiancaAnalise/{id}`. Como o mapa de
status comparava com `===` contra número, a string sumia em silêncio e uma
recusa virava "erro" no resumo.
**Decisão:** `numeroDaApi()` no mapper da fiança. ✅

**Medido — seguradora não habilitada não dá erro, dá análise natimorta.**
Cotar na Too (`too_fianca: false`) foi aceito, voltou `codigoStatus: 0` com
descrição vazia, e o GET devolve zero pareceres. Do lado do corretor é uma
análise parada para sempre, sem explicação.
**Decisão:** virou o item 1.5 das pendências; o filtro veio no dia seguinte.

---

## 16/08/2026 — o dia em que quase tudo quebrou

### O 500 que escondia o motivo

**Medido:** transmitir sem `seguradorasAnalise` significa "todas" para a API — e
"todas" inclui a Tokio, que não aceita análise reduzida. A validação dela
estoura em 500 genérico e **derruba junto as outras três**, que teriam cotado.

```
sem seguradorasAnalise   →  500  "Internal server error"
["tok"] numa reduzida    →  400  "pretendente.dataNascimento não informado"
["por"]                  →  201  parecer normal
```

**Decisão:** a lista passa a ser resolvida no servidor e nunca vai vazia, por
dois critérios — `aceitaAnaliseReduzida` e as flags de habilitação
(`src/lib/seguros/elegiveis.ts`). Se a consulta de habilitação falhar, seguimos
sem esse filtro: esconder todas as seguradoras porque uma consulta caiu é pior
que deixar passar uma natimorta. ✅

### O corpo do erro era descartado

O log gravava "respondeu 500" e jogava fora o único campo que explica a recusa.
**Decisão:** o corpo do erro vai inteiro para `seguro_eventos`, com a duração —
que separa recusa imediata de timeout. ✅

### Biometria pedida em análise recusada

**Medido:** a Porto devolve `statusBiometria: 0` ("Aguardando") mesmo quando
**recusa** a análise. O card olhava só esse campo e mandava o corretor atrás do
inquilino por uma análise encerrada.
**Decisão:** em parecer terminal negativo o bloco de biometria some por
inteiro. ✅

---

## 16/08/2026 (noite) — análise 215549 e três achados

Fiança reduzida, residencial, Cuiabá, R$ 2.000,00, 30 meses, só Porto.
Voltou `codigoStatus 12` — Pré-Aprovado.

### 1. A cotação ficava sem nome ✅

As telas liam o nome só do cadastro (`inquilino_id → pessoas`). Quem digita o
nome no formulário não tem ficha em `pessoas` — e digitar é o caminho normal,
porque na hora de cotar o inquilino ainda não é cliente.
**Decisão:** `identificarPretendente()` lê do cadastro quando existe e cai no
`payload` quando não. Vale para título, lista, busca e notificação.

### 2. O link da biometria não existe no GET ⏳

**Medido:** `GET /apiFiancaAnalise/215549` devolve `statusBiometria` e a
mensagem "Necessária biometria facial para contratação", mas **nunca**
`linkBiometria`.

```json
{ "seguradora": "Porto", "sigla": "por", "codigoStatus": "12",
  "statusBiometria": 0, "descricaoStatus": "Pre-Aprovado",
  "codigoAnalise": "000000018577766" }
```

**Consequência:** o webhook de biometria é o único caminho pelo qual o link
chega. Sem ele cadastrado, a análise fica em pré-aprovado para sempre e a
contratação nunca abre. **É o bloqueio nº 1 do projeto.**

### 3. A transmissão levou 56,2s e provavelmente duplicou ✅ (nosso lado)

Impossível numa tentativa só: o timeout era de 30s **por tentativa**. A primeira
foi abortada, a segunda respondeu — e a primeira já tinha sido entregue e
processada. Deve existir uma **análise órfã** na base deles.

**Decisão:** chamadas que criam registro (`transmitirAnalise`,
`transmitirReanalise`, `contratar`, `cadastrarImobiliaria`, `cancelar`) ganharam
`criaRegistro: true` e não repetem mais sozinhas — só o 401 repete, que é seguro
porque credencial recusada significa que nada foi processado. Timeout dessas
subiu para 55s (a Vercel mata a função em 60s). A mensagem de erro passou a
mandar **conferir antes de reenviar**, em vez de "tente de novo".

### 4. Solidário sumia na análise reduzida ✅

O bloco `pessoal` era montado depois do retorno antecipado da reduzida. Quem
clicava "Reenviar com solidários" transmitia o mesmo payload de antes, sem
ninguém — e parecia que compor renda não adiantava.
**Medido:** o eco do GET de uma reduzida traz `"pessoal": {"numSolidarios": "0"}`,
o que confirma que o bloco pertence ali.
**Falta confirmar** com a corretora se a reduzida *considera* o solidário ou só
aceita o campo. ⏳

---

## 17/08/2026 — o incêndio, que estava quebrado de quatro jeitos

Primeira tentativa de cotação: `400 — "ambiente inválido"`. Testando um campo
por vez contra a API, apareceram quatro causas independentes, **nenhuma
documentada**:

### a) `ambiente` precisa ser texto no incêndio ✅

Na fiança número funciona. Aqui, não:

```
"ambiente": 2     →  400  "ambiente inválido"
"ambiente": "2"   →  201  cotação normal
campo ausente     →  201  cotação normal
```

O terceiro caso é o preocupante: **sem o campo a cotação também passa**, e não
há como saber em que ambiente rodou. Por isso o campo vai sempre, explícito.
A Porto não valida o campo em nenhum formato. ⏳ *perguntado*

### b) A Alfa exige nome e sobrenome ✅

Nome de uma palavra volta `"Nome Segurado Inválido<br/>Nome Beneficiário
Inválido<br/>"` — que não diz o que corrigir. O formulário passou a barrar
antes, com mensagem que diz.

### c) A Porto exige endereço já no cálculo ✅

`"endereco_seguro não informado"`. A Alfa calcula só com CEP e UF. O endereço
subiu para o corpo base e vai nas duas.

### d) A Porto exige `vl_cob_conteudo` > 0 mesmo em "somente prédio" ⏳

E trata zero como campo não informado. O campo passa a ir sempre e o formulário
avisa quando falta, mas **se isso é regra ou validação mal feita não dá para
saber daqui.** Perguntado.

### E os catálogos são todos por seguradora *e* por vigência

**Medido:**

```
ocupações R · Alfa   →  4070/1002 (Apto habitual), 4000/1001 (Casa habitual)…
ocupações R · Porto  →  1/6 (APARTAMENTOS), 2/5 (CASAS DE ALVENARIA)…

pacotes assist · vigência 1 (mensalizado)  →  códigos 1 a 5
pacotes assist · vigência 0 (anual)        →  códigos 8 a 12
```

Código de uma combinação é inválido na outra. Já tratávamos assim — o formulário
recarrega o catálogo quando muda seguradora, tipo ou vigência —, mas fica
registrado porque não está escrito em lugar nenhum.

### f) A Alfa não devolve formas de pagamento ✅

**Medido:** `listaFormasPagto` vem **vazia** em toda cotação da Alfa — nas duas
vigências, com e sem assistência. Como a tela só oferecia o que vinha nessa
lista, a cotação calculava e **não dava para contratar**: não havia o que
escolher.

O painel da corretora não depende dela — deriva do prêmio e da parcela mínima
de R$ 60,00. Prêmio de R$ 210,83 vira 1× 210,83, 2× 105,41, 3× 70,28; para em 3
porque a quarta cairia abaixo do mínimo.

**Decisão:** `opcoesParcelamento()` faz a mesma conta quando a API não manda
nada, e a tela diz que o parcelamento é calculado. A escolha derivada vai sem
`cod_forma_pagto`, campo opcional no `/contratar`. Se a corretora confirmar
quais códigos valem, a lista da API volta a ter preferência. ⏳ *perguntado*

---

## 17/08/2026 (tarde) — a primeira apólice, e o que ela revelou

Apólice de incêndio contratada na Alfa: `codigo_seguro 607773`,
`numero_proposta 1659097`. Primeira contratação de verdade da integração.

### g) O header `seguradora` impede baixar os documentos ✅

O download logo em seguida voltou 400 `"Seguro informado não pertence a
seguradora Alfa"` — sobre uma apólice criada na Alfa minutos antes, pela
própria API.

```
header seguradora "Alfa"  →  400  "não pertence à seguradora Alfa"
header "ALFA"             →  400  mesma mensagem
SEM o header              →  201  certificado + proposta
```

O mesmo 400 acontece com um código real de Alfa tirado do painel deles, o que
descarta erro nosso na contratação. E o `codigo_seguro` é chave global: pedir
um inexistente responde *"não foi encontrado um registro"* — mensagem
diferente. Ou seja, a busca não precisa do header, e com ele quebra.

`imprimirProposta` e `imprimirBoleto` deixaram de mandar o header.
**Confirmado depois:** o download voltou 201 com PDF real de 281 mil caracteres.

O `cancelar` é o terceiro endpoint chaveado por `codigo_seguro` e continua
mandando o header, com comentário no código. **Não medido — cancelamento não é
chamada que se dispara pra experimentar.** ⚠️

### h) O boleto atrasa em relação ao certificado ⏳

Mesmo momento, mesmo código: `imprimirProposta` devolve o certificado e
`imprimirBoleto` responde *"Falha ao imprimir o boleto: Fatura não
encontrada."* A fatura da imobiliária só existe depois do fechamento do lote
deles — o que bate com o "Nº Remessa em Lote" das telas do painel.

Os dois estavam no mesmo `try`: esse erro **esperado** descartava o certificado
já salvo e a tela dizia "falha ao baixar documentos" com dois documentos no
banco. Separados. ✅

E o painel de saúde parou de contar essa recusa como erro de integração —
senão exibiria pra sempre um "último erro" que ninguém precisa investigar,
escondendo atrás dele o que importa. ✅

### i) `data_inquilino` é obrigatória, inclusive para PJ ⏳

Cotar uma ótica (PJ, comercial) voltou `"data_inquilino não informado"`. O
formulário tratava o campo como opcional, e cliente pré-cadastrado sem data é
o normal em empresa.

```
vazia ou ausente  →  400, tanto em PF quanto em PJ
qualquer data     →  passa
```

Campo virou obrigatório, com rótulo **"Abertura da empresa"** quando o
documento é CNPJ. O que a seguradora espera ali numa PJ não dá pra saber daqui
— ela aceita qualquer data. Perguntado.

### j) O limite do vendaval varia com a ocupação ⏳

Sugeríamos 30% do LMI de incêndio.

```
comercial, LMI 700.000:  30%  →  400 "IS da Cobertura ... fora do limite"
                         25%  →  201
residencial, LMI 128.000: 30% →  201
```

Baixado para 25%, que passa nos dois. É chute calibrado — a regra real não está
documentada. Perguntado.

### k) 500 intermitentes ⚠️ *deles*

O mesmo payload, enviado duas vezes seguidas, voltou 500 e depois 201. Repetiu
em dois valores diferentes e sumiu na segunda rodada. Não é bloqueio — o
cliente já repete chamada que não cria registro —, mas está registrado no PDF
como observação ao time deles.

---

## 17/08/2026 — duas coisas construídas em cima disso

**Sessão de homologação (v80).** Link temporário para a equipe técnica da
corretora cotar aqui dentro, com apontamentos que capturam contexto e chamadas
de API sozinhos. Não é acesso de admin: entra como usuário próprio de role
`homologacao`, que alcança o módulo de seguros e mais nada. Detalhe que quase
passou: o painel montava o link com `NEXT_PUBLIC_APP_URL` e gerava
`localhost:3000` pronto pra ser mandado à corretora.

**Comissão de seguros (v81).** Duas comissões independentes por venda — a do
corretor, paga direto pela corretora a ele, e o override da plataforma. Estados
separados, percentual congelado na venda. O percentual do corretor só é
preenchido no incêndio: os 20% vêm da coluna "Pró-labore" do painel deles, que
não existe para fiança. Para fiança fica **"a definir"** — número inventado que
o corretor possa levar para uma conversa com a corretora é pior que campo
vazio.

---

## O que ainda não foi exercitado nenhuma vez

- **Contratação de fiança** (`/contratar`) — bloqueada pela biometria.
- **Webhooks** — nenhum recebido desde 13/08; as URLs não estão cadastradas.
- **Cancelamento de incêndio** — é o único passo do fluxo que falta, e o
  suspeito do header (item g) só se confirma nele.
- **Boleto de incêndio** — depende do fechamento do lote da seguradora.
- **Faturamento de incêndio** (`listarFaturamento`).
- **Qualquer seguradora de fiança que não seja a Porto** — sem habilitação.

---

## O que o painel deles tem e a plataforma ainda não

Levantado das telas de Seguro Incêndio da Maximiza em 17/08/2026. Não é
lista de tarefas — é o que existe lá e vale decidir se queremos aqui.

| O que é | Onde vimos | Nossa situação |
|---|---|---|
| Campo **Tabela** (1 a 20) | topo do cálculo | **não temos, e não sabemos o que é** — não está no payload da API |
| **Taxa por cobertura** e custo líquido de cada uma | grade de coberturas | a API devolve; exibimos só o total |
| **% do prêmio sobre o aluguel** ("13,2% do valor do aluguel") | ao lado do total | não exibimos — é argumento de venda barato |
| **Cálculo inverso** (informa o total, ele acha os valores segurados) | abaixo da vigência | não temos |
| **Coberturas 3, 4 e 5 opcionais por checkbox** (1 e 2 travadas) | grade | mandamos valores; equivalente, mas menos explícito |
| **Prêmio recalculado enquanto preenche** | botão Calcular na mesma tela | nosso cálculo troca de página |
| **Controle / CTRL-PASTA** (referência livre da imobiliária) | endereço | não temos |
| **Seguro sem Administração — Estipulante Particular** | checkbox | não temos; muda quem é o estipulante |
| **Sugestão de cláusula de incêndio para o contrato** | menu lateral | temos banco de cláusulas próprio — dá para cruzar |
| Aviso de **construção inferior/mista não aceita** | caixa amarela | não avisamos |

O primeiro da lista é o que mais importa: **Tabela** é campo obrigatório no
painel deles, sai com `20` por padrão, e não existe em nenhum lugar da API que
recebemos. Se ele mexe em preço ou em comissão, estamos cotando sempre no
padrão sem saber. Está perguntado.

---

*Mantido por João Victor com Claude. Cada entrada nova vai no topo da seção do
dia. As perguntas em aberto vivem em `perguntas-pendentes.md`, que é o arquivo
que se manda para a corretora.*
