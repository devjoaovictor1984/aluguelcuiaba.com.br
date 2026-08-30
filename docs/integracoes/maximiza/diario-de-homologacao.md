# Diário de homologação — Maximiza

Registro do que foi testado contra a API viva, o que quebrou, o que virou
conserto e o que ficou dependendo da corretora. Serve para não redescobrir a
mesma coisa duas vezes e para saber, a qualquer momento, em que pé está.

**Como ler:** cada entrada tem o que foi medido (fato) e o que se fez (decisão).
Fato sem medição não entra aqui — se está escrito, foi observado contra a API.

**Convenções:** ✅ resolvido · ⏳ aguardando a corretora · ⚠️ aberto do nosso lado

---

## 30/08/2026 (noite) — o cadastro existe, mas não funciona

Primeira cotação real sob a IMOBILIATTO, apartamento no Paiaguás, R$ 1.800.
Voltou 400:

```
Erro em EnviaCertificadoXML. Contacte o Administrador.
Erro: Usuário e/ou Senha Inválidos! Tente novamente ou contate Sistemas.
```

**Confirmado primeiro o que interessava:** o `request` gravado em
`seguro_eventos` traz `cpfcnpj_imob: "45528182000106"`. A troca de CNPJ
funcionou — a cotação está saindo sob a IMOBILIATTO.

**E o erro é no `/calculo`, não no `/contratar`.** Nada foi criado do lado
deles: `/calculo` não leva `criaRegistro`. Não há apólice órfã.

### Medido: o mesmo payload, trocando só o CNPJ ⏳ *deles*

```
POST /incendioAlfaV2/calculo   (payload idêntico, só cpfcnpj_imob muda)

Alfa  · 45528182000106 (IMOBILIATTO)  → 400  "Usuário e/ou Senha Inválidos!"
Alfa  · 10961528000180 (teste)        → 201  prêmio 251,69 · 5 coberturas
Porto · 45528182000106 (IMOBILIATTO)  → 400  "Usuário e/ou Senha Inválidos!"
Porto · 10961528000180 (teste)        → 201  prêmio 364,71 · 6 coberturas
```

Falha nas **duas** seguradoras, então não é credencial de uma delas. E não é
credencial nossa: a autenticação passou, o request chegou na regra de
negócio e voltou erro de negócio.

**Conclusão:** a Maximiza criou o cadastro da IMOBILIATTO — o
`consultarImobiliaria` responde 201, com `cod_alfa 5719`, `cod_porto 60132`
e todas as flags true — mas **não provisionou as credenciais das
seguradoras para esse cadastro em homologação**. Estar cadastrado não é o
mesmo que estar funcionando, e as flags mentem sobre isso.

**Decisão nossa, temporária:** `MAXIMIZA_FORCAR_CNPJ_TESTE=1` volta ao CNPJ
de teste mesmo com o cadastro próprio respondendo, pra não travar o roteiro
de teste enquanto eles arrumam. A faixa de ambiente diz quando está forçado,
pra ninguém esquecer ligado. Sai quando a cotação sob a IMOBILIATTO voltar
201. ✅

### Medido: `ocupacoes/R` ignora o header `seguradora` ⚠️ *deles*

Em 17/08 estava registrado que o catálogo de ocupação era por seguradora —
Alfa `4070/1002`, Porto `1/6 (APARTAMENTOS)`. Não é mais:

```
GET /incendioAlfaV2/ocupacoes/R

header seguradora = Alfa              → 200  4070/1002 4080/1002 4000/1001 4010/1001
header seguradora = Porto             → 200  4070/1002 4080/1002 4000/1001 4010/1001
header seguradora = al2               → 200  (idêntico)
header seguradora = por               → 200  (idêntico)
header seguradora = "[object Object]" → 200  (idêntico)
SEM o header                          → 200  (idêntico)
```

Seis valores diferentes, incluindo lixo e ausência, e a mesma resposta. O
endpoint deixou de honrar o header — ou os catálogos foram unificados.

Importa porque o formulário recarrega o catálogo ao trocar de seguradora
achando que recebe outro, e o `/calculo` da Porto aceitou as rubricas da
Alfa (201, 6 coberturas). Se internamente a Porto ainda tem código próprio,
estamos cotando com rubrica errada e recebendo preço mesmo assim — que é
pior do que receber erro. Perguntado.

---

## 30/08/2026 — o primeiro retorno deles, e o que ele não diz

Doze dias sem contato desde a entrega das URLs de webhook em 18/08. Em
28/08, às 17:54, veio por WhatsApp:

> *"Ficou certo para sua imobiliária. Poderia testar o cálculo de incêndio?"*

**Medido no nosso lado, antes de responder qualquer coisa:**

| Onde | O que tem |
|---|---|
| `seguro_eventos` com `direcao = entrada` | **zero registros.** Nenhum webhook chegou desde 13/08 |
| `homologacao_apontamentos` | **vazio.** A equipe técnica deles entrou 7× entre 17/08 e 18/08 12:38 e não anotou nada |
| `sessoes_homologacao` | a sessão deles **expira em 31/08** e não é acessada desde 18/08 |
| último evento nosso | 30/08 15:42 — três chamadas de catálogo do formulário de incêndio |

Ou seja: o retorno veio por fora do sistema, e nada mudou nos três bloqueios
de fiança.

### A pegadinha do "teste o cálculo"

`garantirImobiliaria()` (`src/lib/seguros/imobiliaria.ts`) devolvia o CNPJ de
teste **na primeira linha**, antes de ler o perfil, sempre que
`MAXIMIZA_AMBIENTE=2`. Testar assim exercitaria `10.961.528/0001-80`
(MAXIMIZA IMOB TEMP - DF), **não a IMOBILIATTO** — passaria bonito e não
provaria nada sobre o que eles acabaram de habilitar.

### O que a consulta respondeu ✅

Em vez de perguntar em qual ambiente habilitaram, medimos: o
`consultarImobiliaria` não cria registro, então dá pra consultar à vontade.
Com a credencial de **homologação**, o CNPJ da IMOBILIATTO respondeu:

```
POST /apiImobiliaria/consultarImobiliaria  { "cnpj_cpf": "45528182000106" }
→ 201

razao   J. V. VIEIRA LTDA        fantasia  IMOBILIATTO
cod_alfa 5719                    cod_porto 60132
porto_incendio true    alfa_incendio     true    yelum_incendio false
porto_fianca   true    too_fianca        true
tokio_fianca   true    pottencial_fianca true
```

Contra o CNPJ de teste, na mesma base e no mesmo minuto:

```
MAXIMIZA IMOB TEMP - DF
porto_fianca true · too_fianca FALSE · tokio_fianca FALSE · pottencial_fianca FALSE
```

**Duas conclusões.** Habilitaram em **homologação** — a IMOBILIATTO responde
na base que a credencial de homologação enxerga. E habilitaram **as quatro
seguradoras de fiança**, não só incêndio: o item 1.6 pedia isso no CNPJ de
teste e eles resolveram na imobiliária, o que serve igual agora que dá pra
cotar sob ela. **Um dos três bloqueios do projeto cai aqui.**

Sobra a biometria, que depende do webhook — e webhook continua zerado.

### A troca de CNPJ deixou de ser incondicional ✅

`cnpjParaHomologacao()` substitui o antigo atalho: em ambiente 2, usa o CNPJ
do próprio corretor quando ele já responde na base deles, e cai no de teste
quando não responde. Confirmado que `perfis.cnpj` do João já é
`45528182000106`, então a cotação passa a sair sob a IMOBILIATTO.

O resultado **não** é gravado em `seguro_imobiliarias`: aquela linha guarda
`cod_alfa` e `cod_porto`, que são da base de homologação e não valem em
produção. Custa uma consulta por cotação, que não cria registro.

O convidado da sessão de homologação continua caindo no CNPJ de teste — ele
não tem perfil nenhum, que é exatamente o caso pro qual a rede existe.

**Confirmado na leitura do código, e é o que torna o teste viável:** o
`/calculo` não leva `criaRegistro` — não cria nada, não emite nada, repete à
vontade. Só `/contratar` e `/cancelar` criam registro. Então o cálculo pode
rodar até em produção sem emitir apólice; o risco é o botão ao lado.

### O que foi construído por causa disso ⚠️ *nosso lado*

Virar `MAXIMIZA_AMBIENTE` para 1 deixou de ser hipótese, e a tela era
**idêntica** nos dois ambientes — mesma cor, mesmo botão, mesmo lugar. Quem
abrisse a aba antes de um deploy que virasse o ambiente emitiria apólice real
achando que testava.

- **`FaixaAmbiente`** em todas as telas de seguros: cinza em homologação
  (dizendo sob qual CNPJ a cotação sai), vermelha em produção. ✅
- **Confirmação explícita** antes de contratar em produção, com o valor que o
  cliente vai pagar escrito nela; o botão muda de cor e de texto para
  "Emitir apólice real". ✅
- **Trava no servidor**, e não só na tela: `contratarApoliceIncendio` recusa em
  ambiente 1 sem o aceite. A tela pode estar velha — uma aba aberta antes do
  deploy não tem a caixa de confirmação, e sem a trava emitiria. ✅

### O `listarSeguradorasDisponiveis` mudou de formato ⚠️ *deles*

Primeira cotação depois do deploy: o seletor de seguradora mostrou
**"[object Object]" duas vezes**. Não era coisa faltando — o corpo da
resposta mudou desde a medição de 16/08.

```
GET /incendioAlfaV2/listarSeguradorasDisponiveis

16/08  200  ["Alfa","Porto"]
30/08  200  [{"seguradora":"Alfa","sigla":"al2"},{"seguradora":"Porto","sigla":"por"}]
```

Mesmo endpoint, mesmo método, mesmo status. Só o contrato de resposta. E
apareceu um campo que não existia: `sigla` — `al2` na Alfa, `por` na Porto
(a mesma sigla que a fiança já usava para a Porto).

`String(objeto)` devolve `"[object Object]"`, então o nome sujo ia da tela
para o header `seguradora` das chamadas seguintes. O `ocupacoes/R` respondeu
200 mesmo assim, o que sugere que ele não valida o header — mas isso é
sorte, não desenho.

**Decisão:** `lerSeguradorasIncendio` aceita as duas formas e continua
devolvendo só o nome, que é o que o resto do fluxo usa. Forma desconhecida
vira string vazia e é filtrada — uma terceira mudança de formato devolve
lista vazia em vez de encher o header de lixo. ✅

Se a `sigla` passa a ser o valor esperado no header, não dá pra saber daqui.
Perguntado (item 7.1, que era um ✅ e voltou a ser pergunta).

### Quatro pontas do painel deles, fechadas (v86)

- **Taxa por cobertura** — a API já devolvia `lmi` e `premio` por cobertura;
  exibíamos só o total. Agora sai a taxa de cada uma. ✅
- **% do prêmio sobre o aluguel** — o argumento de venda que o painel deles
  mostra ao lado do total. ✅
- **Campo Controle / CTRL-PASTA** — referência livre da imobiliária, migration
  v86. Não vai pra seguradora; entra na busca da listagem. ✅
- **Aviso de construção inferior/mista não aceita** — caixa amarela no painel
  deles, dado que a API não devolve. Agora avisa antes de cotar, não na
  recusa. ✅

---

## Estado atual — 30/08/2026

| Frente | Onde está |
|---|---|
| Fiança — análise | ✅ funciona; para em pré-aprovado, como a regra deles prevê |
| Fiança — seguradoras | ✅ as quatro habilitadas na IMOBILIATTO (30/08); só a Porto no CNPJ de teste |
| Fiança — biometria | ⏳ sem caminho: o link só vem por webhook, que não está cadastrado |
| Fiança — contratação | ⏳ bloqueada pela biometria; nunca exercitada |
| Incêndio — cálculo | ✅ funciona na Alfa e na Porto |
| Incêndio — contratação | ✅ apólice 607773 emitida em homologação |
| Incêndio — documentos | ✅ certificado e proposta; boleto sai depois do lote |
| Incêndio — cancelamento | ✅ "Certificado cancelado com sucesso" |
| Incêndio — ligar em produção | ⏳ falta credencial de produção e o pró-labore confirmado — ver `incendio-para-ligar.md` |
| Webhooks | ⏳ **nenhum recebido desde 13/08**; URLs entregues em 18/08 |
| Sessão de homologação deles | ⚠️ expira 31/08, sem acesso desde 18/08 e sem nenhum apontamento |
| Comissões | ✅ registradas na venda; percentuais dependem da corretora |
| Modelo comercial | ⏳ nada definido — ver `perguntas-pendentes.md`, bloco 2 |

**Ambiente:** homologação (`MAXIMIZA_AMBIENTE=2`), local e na Vercel. Desde
30/08 a tela diz em qual ambiente está, e contratar em produção exige aceite
explícito — na tela e no servidor.
**CNPJ em homologação:** o do próprio corretor quando responde na base deles
(a IMOBILIATTO responde desde 28/08); `10.961.528/0001-80` (MAXIMIZA IMOB
TEMP - DF) como rede pra quem não tem cadastro lá.
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

**Medido em seguida, na mesma apólice:** o `cancelar` faz igual. Com o header,
400 `"Seguro informado não pertence a seguradora Alfa"`; sem ele, passa. A
regra vale para os **três** endpoints chaveados por `codigo_seguro`. Os três
deixaram de mandar o header. ✅

A primeira tentativa de cancelar nem chegou a esse ponto: foi abortada aos 30s.
Descobrimos aí que o teto maior de tempo tinha ficado só nas chamadas de
fiança — o incêndio seguia em 30s. Corrigido. E logo depois veio o motivo real
da demora: **entre ~18h10 e ~18h25 todos os endpoints do host de incêndio
responderam `504 Gateway Time-out`**, inclusive um que havia respondido 201 uma
hora antes. A autenticação seguia normal. Voltou sozinho. ⚠️ *deles*

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

## 18/08/2026 — fluxo de incêndio fechado

`cancelar` sem o header devolveu **"Certificado cancelado com sucesso."** na
apólice 607773. Com isso o incêndio está percorrido de ponta a ponta:

```
cálculo → contratação → certificado e proposta → cancelamento
```

Sobra o **boleto**, que não depende de nós: a fatura da imobiliária só existe
depois do fechamento do lote da seguradora.

Dois defeitos nossos que só apareceram porque a primeira tentativa falhou:

- **`cancelar` e `excluir` não limpavam as mensagens anteriores.** O erro do
  timeout ficou na tela ao lado do "cancelado com sucesso" — o corretor lê as
  duas e não sabe no que acreditar. Toda ação agora começa limpando. ✅
- **O aviso do boleto era pintado de vermelho.** "O boleto ainda não foi
  gerado" é o curso normal das coisas, não falha; virou estado próprio, em
  âmbar. ✅

---

## O que ainda não foi exercitado nenhuma vez

- **Contratação de fiança** (`/contratar`) — bloqueada pela biometria.
- **Webhooks** — nenhum recebido desde 13/08; as URLs não estão cadastradas.
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
