# Diário de homologação — Maximiza

Registro do que foi testado contra a API viva, o que quebrou, o que virou
conserto e o que ficou dependendo da corretora. Serve para não redescobrir a
mesma coisa duas vezes e para saber, a qualquer momento, em que pé está.

**Como ler:** cada entrada tem o que foi medido (fato) e o que se fez (decisão).
Fato sem medição não entra aqui — se está escrito, foi observado contra a API.

**Convenções:** ✅ resolvido · ⏳ aguardando a corretora · ⚠️ aberto do nosso lado

---

## 08/09/2026, à noite — cotando de verdade em produção: o que bateu e o que não

Continuação da entrada de mais cedo. Depois de virar o `MAXIMIZA_AMBIENTE`
para 1 na Vercel, o fluxo foi exercitado pela tela, e não por script. Rendeu
mais achado do que o dia inteiro anterior.

### A API deles degradou, e voltou ⏳ *deles*

Entre ~17h e ~18h30, medido daqui:

```
/auth                          30,2s · 33,5s · 45,5s · um timeout de 30s · um HTTP 500
listarSeguradorasDisponiveis   0,8s a 13,2s
ocupacoes/R                    28,4s · 43,1s · 50,8s · dois sem resposta em 90s
listaPacotesAssist24hs         sem resposta em 90s
consultarImobiliaria           63,7s
/calculo                       sem resposta em 90s
```

Em 30/08 os mesmos endpoints saíam em ~1s. Depois das 18h30 normalizou:
`/calculo` em 2,4s a 3,9s, `ocupacoes` em 1,2s. O `seguro_eventos` do site
guardou o retrato: duas chamadas de 91s morrendo no timeout e uma devolvendo
200 depois de **62 segundos**.

### Três consertos nossos que só apareceram por causa disso ✅

**1. `consultarImobiliaria` tratava falha como "não existe".** O `catch`
devolvia `null` tanto para "consultei e não achei" quanto para "não consegui
consultar", e quem chama trata `null` como *cadastrar*. Com a API lenta, o
timeout virou "não existe" e o app chamou `cadastrarImobiliaria` para um CNPJ
que já estava lá: voltou 400 "já cadastrado". **O 400 é que salvou** — com
outro tempo de resposta teria nascido um segundo cadastro da IMOBILIATTO na
base deles. Agora são três estados, e *ausente* só quando há resposta de
negócio (4xx).

**2. Timeout de 30s nas consultas, abaixo do cold start deles.** Catálogos,
cadastro e cálculo passaram a 55s (`TIMEOUT_CONSULTA`). São chamadas que só
leem: esperar é seguro e repetir não duplica.

**3. A tela ficava "Carregando seguradoras…" para sempre.** O `useEffect`
engolia a rejeição da action, e lista vazia tinha a mesma aparência de falha.
Agora há estado, mensagem e botão de tentar de novo.

### O teto das coberturas acessórias: 30% do LMI de incêndio ✅

A cotação voltou `"IS da Cobertura: Perda ou Pagamento de Aluguel fora do
limite"`, que não diz qual é o limite nem sobre o que incide. Medido:

```
LMI incêndio 144.000 · perda 43.200 (30%) → 201
LMI incêndio 144.000 · perda 50.400 (35%) → 400  fora do limite
LMI incêndio  60.000 · perda 18.000 (30%) → 201
LMI incêndio  60.000 · perda 21.000 (35%) → 400  fora do limite
```

Quebra no mesmo ponto nos dois LMIs: é **proporção, não valor absoluto**.
Bate com o vendaval de 17/08, que passava a 30% em residencial e era recusado
a 30% em comercial — ou seja, em comercial o teto é menor, e onde ele fica
continua sem medição. O formulário passou a barrar antes, dizendo o máximo em
reais.

### O prêmio depende do LMI, não do aluguel

Mesma cobertura de perda de aluguel em R$ 10.800 com aluguel de R$ 1.800 e de
R$ 3.000 devolve o mesmo prêmio, centavo por centavo. O aluguel só alimenta a
nossa tabela de sugestão; para a seguradora ele não entra na conta.

### Anual e mensalizado são a mesma tarifa dividida por 12

```
                    ANUAL      MENSAL    mensal × 12
Prêmio líquido     339,64       28,31        339,72
IOF                 25,07        2,09         25,08
TOTAL              364,71       30,40        364,80
```

Cobertura por cobertura o mesmo. Vale para não confundir preço com modalidade
quando o corretor comparar.

### ⚠️ O achado da noite: nossa taxa diverge da do painel deles

O João cotou o MESMO caso no painel da Maximiza (residencial, Apto-Habitual,
**Tabela 20**, aluguel 1.800, 365 dias) e mandou o print. Reproduzimos o
payload idêntico na API — só incêndio 150.000 e perda de aluguel 10.800, as
demais em zero, como estavam lá.

**O total quase bate:**

```
                        API        painel (Tabela 20)
Incêndio 150.000      102,98            105,50
Perda     10.800       11,81              8,93
──────────────────────────────────────────────────
Prêmio líquido        114,79            114,43      diferença de 0,3%
```

**Mas as taxas por cobertura divergem, e nos dois sentidos:**

| Cobertura | taxa do painel | taxa implícita da API | razão |
|---|---|---|---|
| Incêndio | 0,07033% | 0,06865% | 0,98 |
| Perda de aluguel | 0,0827% | 0,1094% | 1,32 |
| Vendaval | 0,596% | 0,2656% | 0,45 |
| Responsabilidade civil | 0,1117% | 0,0455% | 0,41 |
| Danos elétricos | 0,7247% | **1,6881%** | **2,33** |

Não é prêmio mínimo: variando o LMI de danos elétricos de 3.600 a 45.000 a
taxa implícita fica em 1,688% em todos os pontos — perfeitamente linear.

**E a resposta da API não traz taxa.** As chaves de cobertura são `cdcob`,
`nmcobert`, `lmi`, `premio` e `txtfranq`; a taxa que a nossa tela mostra é
derivada (prêmio ÷ LMI). Por isso a comparação acima é de taxa efetiva contra
taxa de tabela.

### O campo "Tabela" não existe na API — testado ⏳ *deles*

Seis nomes plausíveis, com valor 20 e com 1, no mesmo payload:
`tabela`, `cod_tabela`, `nr_tabela`, `tabela_preco`, `cdtabela`, `id_tabela`.
**Nenhum muda um centavo** — a API aceita o campo desconhecido e ignora.

Como a API sem tabela nenhuma dá 114,79 contra os 114,43 da Tabela 20, o
padrão dela é a 20 ou coisa muito próxima. O que continua sem resposta é o que
as tabelas 1 a 19 fazem: se alguma delas for mais barata, estamos cotando caro
sem saber. **Isto vira a pergunta nº 1 para a corretora**, no lugar do item 3.1
antigo, que agora tem medição.

### Por que os R$ 364,71 pareciam absurdos perto dos R$ 131,99

Não era tarifa: era **seleção de cobertura**. No painel deles só as duas
primeiras vinham marcadas; a nossa sugestão liga as seis. As quatro extras
somam R$ 228,97 dos R$ 343,76 — 67% do prêmio. Danos elétricos sozinho, a
1,69%, custa mais que a cobertura principal de incêndio.

**Aberto do nosso lado ⚠️:** decidir se a sugestão continua ligando as seis.
Como está, toda cotação nossa sai ~2,8× a do painel deles para o mesmo imóvel.

### A tela de diagnóstico, e o convidado que não conseguia cotar ✅

Entrou `/homologacao/diagnostico`: cotação passo a passo, com semáforo, tempo e
status de cada chamada, e um botão que copia o relatório. Não emite nada —
`contratar`, `cancelar` e `cadastrarImobiliaria` não são importados ali.

O link foi enviado à equipe técnica deles (sessão "Equipe técnica", 30 dias) e
a primeira coisa que aconteceu foi o convidado esbarrar em "Complete seu
perfil antes de cotar", com um botão que o devolvia à inicial. Ele não tem
imobiliária nem CNPJ, e é o NOSSO cadastro que ele foi convidado a conferir.
Consertado: o convidado coteja sob o CNPJ de quem abriu a sessão, e a
contratação fica desligada para ele — cotar e consultar seguem livres.

Rodado por eles às 18:33, os cinco passos verdes:

```
Cadastro da imobiliária   1,1s · 201    J. V. VIEIRA LTDA · Alfa 5719 · Porto 60132
Seguradoras disponíveis   261ms · 200   Alfa, Porto
Catálogo de ocupações     1,2s · 200    4 ocupações
Pacotes de assistência    811ms · 200   5 pacotes
Cálculo do prêmio         3,0s · 200    prêmio 364,71 · 6 coberturas
```

### Divergência de catálogo, para perguntar

O painel deles oferece **seis** ocupações residenciais (apto habitual, apto
veraneio com porteiro, casa habitual, casa em condomínio fechado, casa
veraneio com caseiro, casa veraneio em condomínio fechado). O
`ocupacoes/R` da API devolve **quatro** (apartamento habitual, apartamento
veraneio, casa habitual, casa veraneio). Como a ocupação entra na tarifa, as
duas que faltam podem ser preço diferente que não temos como pedir.

---

## 08/09/2026 — era ambiente: em produção a IMOBILIATTO cota ✅

De manhã, pelo WhatsApp:

> *"Favor testar em modo produção. Essa credencial para cálculo incêndio Alfa
> é somente em modo produção."*

Primeira resposta desde 31/08, quando pediram o JSON de envio. Explica os dez
dias de 400: o vínculo do cadastro da IMOBILIATTO com a Alfa existe, só que **no
ambiente de produção**, e nós vínhamos batendo em homologação. Não era cadastro
quebrado — era cadastro no outro lado da porta.

### Medido: o espelho exato da homologação ✅

Mesmo payload congelado de 30/08, mesma vigência de 12 meses, mudando só o
`ambiente` de `"2"` para `"1"`. `/auth` em 201 antes das três:

```
POST /incendioAlfaV2/calculo     ambiente "1" (PRODUÇÃO)

A) 45528182000106 · header Alfa   → 201  prêmio 364,71 · líq 339,64 · IOF 25,07 · 6 coberturas
B) 10961528000180 · header Alfa   → 400  "Usuário e/ou Senha Inválidos!"
C) 45528182000106 · header Porto  → 201  prêmio 364,71 · líq 339,64 · IOF 25,07 · 6 coberturas
```

**A tabela inteira inverte.** Em homologação a IMOBILIATTO dava 400 e o CNPJ
de teste cotava; em produção a IMOBILIATTO cota e o CNPJ de teste dá 400 — a
mesma mensagem, palavra por palavra. Dois CNPJs, dois ambientes, cada um
provisionado no seu: nenhuma outra explicação sobrevive às seis células.

E o prêmio de produção sob a IMOBILIATTO bate centavo por centavo com o que a
homologação vinha devolvendo sob o CNPJ de teste — 364,71 / 339,64 / 25,07, as
mesmas 6 coberturas. Mesma tarifa nos dois lados.

Isso **fecha o item 1.3** de `incendio-para-ligar.md`, aberto desde 30/08. Não
havia nada a consertar: faltava saber onde testar.

### O que continua igual, agora medido em produção ⏳ *deles*

**A escolha de seguradora segue sem efeito** (item 1.4). A e C são o mesmo
payload com header `Alfa` e `Porto`, e voltam idênticos — prêmio, líquido, IOF
e contagem de coberturas. O header parou de rotear em homologação em 30/08 e
em produção nunca roteou. A pergunta continua de pé, e agora vale para o
ambiente que emite: **como se pede a cotação de uma seguradora específica?**
Enquanto não houver resposta, o seletor da tela é decorativo — e em produção
decorativo custa caro, porque o corretor escolhe Porto, recebe um preço e
contrata sem saber de quem ele é.

**A fiança não foi tocada.** A biometria da 215549 e os webhooks continuam
como em 06/09. Se o mesmo "é só em produção" também vale lá, ainda não foi
medido — e medir exige transmitir uma análise, que em produção cria proposta
de verdade. Não se faz por conta própria: perguntar antes.

### Como repetir

```
node scripts/testa-incendio-imobiliatto.mjs --producao
```

A flag `--producao` é nova de hoje e troca só o campo `ambiente` do corpo.
Continua chamando **exclusivamente o `/calculo`**, que é consulta de preço:
sem `criaRegistro`, sem apólice, sem cobrança. `/contratar` não existe neste
script, de propósito — é o que separa "rodar à vontade" de "emitir sem
querer".

### Consertado do nosso lado ✅

`form-incendio.tsx:169` — o fim da vigência recebia `c.dataTermino` ao puxar
contrato do CRM, mandando 30 meses ao cálculo num contrato de 30. Agora soma
12 meses ao início, igual à digitação manual. Estava no diário como aberto
desde 01/09, com a nota de que viraria recusa no minuto em que a credencial
funcionasse. A credencial funcionou hoje.

### O app NÃO foi ligado em produção ⚠️

`MAXIMIZA_AMBIENTE` continua `2`, local e na Vercel. O teste de hoje foi por
script, fora do app. Trocar para `1` faz o **`/contratar` da tela emitir
apólice real e cobrança real** — e antes disso falta o que está no item 2 de
`incendio-para-ligar.md`: pró-labore confirmado, regra de cancelamento e
estorno, tabela de comissionamento e o contrato de parceria. É decisão de
negócio, não de código.

---

## 06/09/2026 — reteste dos dois produtos: nada se moveu em cinco dias

Cinco dias depois do reteste de 01/09, e nove desde o "ficou certo para sua
imobiliária". Continua sem retorno ao JSON mandado em 31/08.

### Incêndio — o mesmo 400 de credencial ⏳ *deles*

`node scripts/testa-incendio-imobiliatto.mjs`, `/auth` em 201 antes das três:

```
POST /incendioAlfaV2/calculo     (payload congelado de 30/08)

A) 45528182000106 · header Alfa   → 400  "Usuário e/ou Senha Inválidos!"
B) 10961528000180 · header Alfa   → 201  prêmio 364,71 · líq 339,64 · IOF 25,07 · 6 coberturas
C) 45528182000106 · header Porto  → 400  (mesma mensagem)
```

B saiu idêntico ao de 01/09 e ao de 30/08, centavo por centavo — o ambiente
deles está de pé e não foi mexido. O que falha é o mesmo vínculo de sempre.

### Fiança — a biometria continua sem caminho ⏳ *deles*

`GET /apiFiancaAnalise/{id}` nas três análises reais (leitura pura, não
transmite nada):

```
215549 → 200  Porto · codigoStatus 12 Pré-Aprovado · statusBiometria 0
              linkBiometria AUSENTE · msg "Necessária biometria facial para contratação"
215544 → 200  Porto · codigoStatus 3 Recusado
215542 → 200  Porto · codigoStatus 3 Recusado
```

**Vinte dias parada no mesmo ponto.** A 215549 está pré-aprovada desde 17/08 e
a reconsulta segue pedindo a biometria sem devolver o link dela. Confirma pela
segunda medição o que já estava no diário: o link só chega por webhook, e
webhook não há. A contratação de fiança continua sem como ser exercitada.

### As flags continuam mentindo — agora medido nos dois CNPJs

`POST /apiImobiliaria/consultarImobiliaria` (não cria registro):

| | IMOBILIATTO 45528182000106 | teste 10961528000180 |
|---|---|---|
| razão | J. V. VIEIRA LTDA | MAXIMIZA IMOB TEMP - DF |
| cod_alfa / cod_porto | 5719 / 60132 | 4695 / 3608 |
| `alfa_incendio` · `porto_incendio` | true · true | true · true |
| `yelum_incendio` | false | false |
| fiança (porto/too/tokio/pottencial) | **true nas quatro** | só `porto_fianca` |

Idêntico a 30/08. A IMOBILIATTO tem `alfa_incendio: true` e `porto_incendio:
true` e mesmo assim o `/calculo` recusa a credencial nas duas — vale como
prova de que a flag descreve o cadastro, não o provisionamento.

### Medido junto, no mesmo minuto

| Onde | O que tem |
|---|---|
| `seguro_eventos` com `direcao = entrada` | **zero.** Nenhum webhook desde 13/08 — 24 dias |
| último evento de qualquer direção | 30/08 23:48, saída, `/incendioAlfaV2/calculo` |
| `homologacao_apontamentos` | **vazio** |
| `sessoes_homologacao` | expirada em 31/08; 7 acessos, o último em 18/08 12:38 |

### Aberto do nosso lado ⚠️

`form-incendio.tsx:169` segue como em 01/09: ao puxar contrato do CRM, o fim da
vigência recebe `c.dataTermino` em vez de `somarMeses(inicio, 12)`. Digitação
manual continua certa (linha 478). Não é a causa do 400, mas vira recusa no
minuto em que a credencial funcionar.

### Nunca exercitado, e continua nunca

A cotação de fiança sob o CNPJ da IMOBILIATTO. Todas as análises existentes são
de 15–17/08, anteriores à troca de CNPJ (v86, 30/08) — ou seja, saíram sob o
CNPJ de teste. Se o problema de provisionamento também alcança a fiança, isso
ainda não foi medido, e medir exige transmitir uma análise nova (cria registro
do lado deles).

---

## 01/09/2026 — reteste: o cadastro continua sem credencial na seguradora

Em 31/08, 08:12, eles pediram por WhatsApp o JSON de envio da cotação. Foi
mandado o corpo real do `/calculo` que falhou em 30/08 — extraído do
`seguro_eventos`, não reconstruído — com endpoint, headers, a resposta 400 e o
A/B do CNPJ. Nenhum retorno até agora.

### Medido: nada mudou ⏳ *deles*

Quatro chamadas contra a homologação, `/auth` respondendo 201 antes de todas:

```
POST /incendioAlfaV2/calculo     (payload de 30/08, salvo em cotacao-incendio-envio.json)

A) 45528182000106 · header Alfa                → 400  "Usuário e/ou Senha Inválidos!"
B) 10961528000180 · header Alfa                → 201  prêmio 364,71 · 6 coberturas
C) 45528182000106 · header Porto               → 400  (mesma mensagem)
D) 45528182000106 · header Alfa · vigência 12m → 400  (mesma mensagem)
```

**D existe para fechar uma porta.** O payload de 30/08 leva
`fim_vigencia_seguro` a 30 meses — o formulário copia a data de término do
contrato de locação em vez de somar 12 (ver o aberto abaixo). Rodar com
01/09/2026 → 01/09/2027 devolve o mesmo erro, então a vigência não tem parte
nisso e não serve como desvio quando eles responderem.

**B é o controle de que o ambiente deles não foi tocado:** prêmio, coberturas
e valores idênticos aos de 30/08, cobertura por cobertura. O que falha continua
sendo o vínculo entre o cadastro da IMOBILIATTO e as credenciais das
seguradoras, e ele segue como estava.

Repetível com `node scripts/testa-incendio-imobiliatto.mjs` — é `/calculo`, não
leva `criaRegistro`, não emite nada.

### Medido junto, no mesmo minuto

| Onde | O que tem |
|---|---|
| `seguro_eventos` com `direcao = entrada` | **zero.** Nenhum webhook desde 13/08 — três semanas |
| `homologacao_apontamentos` | **vazio**, como em 30/08 |
| `sessoes_homologacao` | **expirou** em 31/08 16:58; 7 acessos, nenhum desde 18/08 12:38 |

A sessão de homologação deles morreu sem nunca ter registrado um apontamento.
Se voltarem a pedir acesso, tem que ser emitida outra.

### Aberto do nosso lado ⚠️

`form-incendio.tsx:169` — ao puxar um contrato do CRM, o fim da vigência do
seguro recebe a data de término do **contrato** (01/09/2026 → 28/02/2029, 30
meses) em vez de somar 12 meses. A digitação manual está correta (linha 478).
Não é a causa do 400, mas vira recusa assim que a credencial funcionar.

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

### Medido: o `/calculo` também ignora o header — o seletor está decorativo ⚠️ *deles*

Pior que o `ocupacoes`. Payload **idêntico**, só variando o header:

```
POST /incendioAlfaV2/calculo

header seguradora = Alfa   → 201  premio 364.71 · liq 339.64 · iof 25.07 · 6 coberturas
header seguradora = Porto  → 201  (idêntico)
header seguradora = al2    → 201  (idêntico)
header seguradora = por    → 201  (idêntico)
SEM header                 → 201  (idêntico)
```

Procuramos roteamento novo no corpo — `seguradora`, `sigla`, `cdseguradora`,
`cia`. Nenhum muda o resultado.

**Consequência:** o seletor de seguradora da nossa tela não faz nada.
Escolher Porto grava `seguradora: "Porto"` numa cotação que a API calculou
como se fosse outra coisa. Não dá pra consertar daqui sem saber qual é o
mecanismo novo — e o dado gravado fica mentindo enquanto isso.

Cuidado com uma leitura errada que quase tivemos: mais cedo a Alfa deu
251,69/5 coberturas e a Porto 364,71/6, o que parecia diferença entre
seguradoras. Não era — o payload da Alfa ia com `vl_cob_vendaval: 0`. Com o
mesmo payload, o resultado é igual. Comparação entre seguradoras só vale com
payload idêntico.

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

## Estado atual — 06/09/2026

| Frente | Onde está |
|---|---|
| Fiança — análise | ✅ funciona; para em pré-aprovado, como a regra deles prevê |
| Fiança — seguradoras | ✅ as quatro habilitadas na IMOBILIATTO (30/08); só a Porto no CNPJ de teste |
| Fiança — biometria | ⏳ sem caminho: o link só vem por webhook, que não está cadastrado; 215549 parada há 20 dias (06/09) |
| Fiança — contratação | ⏳ bloqueada pela biometria; nunca exercitada |
| Incêndio — cálculo | ⏳ **só sob o CNPJ de teste.** Sob a IMOBILIATTO, 400 de credencial na Alfa e na Porto |
| Incêndio — seleção de seguradora | ⚠️ o header deixou de rotear; o seletor da tela está decorativo (30/08) |
| Incêndio — contratação | ✅ apólice 607773 emitida em homologação |
| Incêndio — documentos | ✅ certificado e proposta; boleto sai depois do lote |
| Incêndio — cancelamento | ✅ "Certificado cancelado com sucesso" |
| Incêndio — ligar em produção | ⏳ falta credencial de produção e o pró-labore confirmado — ver `incendio-para-ligar.md` |
| Webhooks | ⏳ **nenhum recebido desde 13/08** (24 dias); URLs entregues em 18/08 |
| Sessão de homologação deles | ⚠️ **expirada desde 31/08**; 7 acessos, nenhum desde 18/08, zero apontamentos |
| Comissões | ✅ registradas na venda; percentuais dependem da corretora |
| Modelo comercial | ⏳ nada definido — ver `perguntas-pendentes.md`, bloco 2 |

**Ambiente:** homologação (`MAXIMIZA_AMBIENTE=2`), local e na Vercel. Desde
30/08 a tela diz em qual ambiente está, e contratar em produção exige aceite
explícito — na tela e no servidor.
**CNPJ em homologação:** o do próprio corretor quando responde na base deles
(a IMOBILIATTO responde desde 28/08); `10.961.528/0001-80` (MAXIMIZA IMOB
TEMP - DF) como rede pra quem não tem cadastro lá.
**Habilitações do CNPJ de teste:** só `porto_fianca`; incêndio tem Porto e Alfa.
**`MAXIMIZA_FORCAR_CNPJ_TESTE=1`** está ligado desde 30/08: volta ao CNPJ de
teste mesmo com a IMOBILIATTO respondendo, pra não travar o roteiro enquanto
eles não provisionam. Desligar assim que a cotação sob a IMOBILIATTO voltar 201.

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
