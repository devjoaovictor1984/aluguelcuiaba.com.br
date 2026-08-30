# Integração AluguelCuiabá × Maximiza — pontos em aberto

**Situação (16/08/2026):** a integração está de pé e chegou até onde a
homologação permite. `transmitirAnalise` e `GET /apiFiancaAnalise/{id}`
respondem, o parecer chega, e a análise para em **pré-aprovado** — como vocês
descreveram. Daí não sai.

Três coisas travavam a continuação dos testes. A habilitação das outras
seguradoras (1.6) **caiu em 28/08** — vocês ligaram as quatro na IMOBILIATTO.
Sobram duas, e as duas dependem de vocês: **cadastro das URLs de webhook**
(1.2) e **como concluir uma biometria em homologação** (3.4.1). Sem a
primeira, nenhuma análise passa de pré-aprovado e a contratação nunca chega a
ser exercitada.

Em paralelo segue aberto o **bloco 2 (modelo comercial)**.

Os pontos abaixo estão agrupados por urgência. Itens marcados ✅ foram
respondidos — ficam registrados porque a resposta virou decisão de código.

---

## 0. Respondido em 13–14/08/2026

**Credencial** — `api.aluguelcuiaba@maximizaseguros.com.br` autentica em
`POST https://auth.api.seguro.imb.br/auth` (HTTP 201). Uma observação para o
time técnico de vocês: o JWT devolvido dura **30 minutos** (`exp - iat` = 1800s),
não os prazos longos que a documentação sugere. Ajustamos o cache do token para
renovar 5 minutos antes do vencimento.

**Status da análise** — vocês esclareceram que a análise de crédito devolve
apenas **recusado**, **em análise** e **pré-aprovado**; o **aprovado só sai
depois da biometria**, e o pré-aprovado pode voltar a recusado se a biometria
não confirmar a identidade. Implementamos assim: a contratação fica **bloqueada**
enquanto o parecer não estiver aprovado (códigos 1 ou 5), o pré-aprovado (12)
ganhou estado próprio na interface e o corretor vê explicitamente que ainda não
dá para fechar. Ver 3.4 para a confirmação dos códigos.

**CNPJ de testes** — `10.961.528/0001-80` (MAXIMIZA IMOB TEMP - DF) responde no
`consultarImobiliaria`. Usamos apenas em homologação.

**Análise ponta a ponta (15/08/2026)** — transmitimos duas análises reduzidas
de teste em homologação (ids `215527` e `215528`). A primeira, na Porto, voltou
parecer normalmente. O que a segunda revelou está em 1.5.

**Observação técnica: o tipo do `codigoStatus` muda conforme o endpoint.**
`POST /apiFiancaAnalise/transmitirAnalise` devolve `"codigoStatus": 3` (número);
`GET /apiFiancaAnalise/{id}` devolve `"codigoStatus": "3"` (string), para a
mesma análise. O mesmo vale para `statusBiometria`. Já tratamos os dois casos
do nosso lado, mas vale o alerta ao time de vocês: quem comparar o código com
igualdade estrita vai ler uma aprovação como estado desconhecido. Se houver
intenção de padronizar, preferimos número — e avisem, porque aceitamos ambos.

**Análise 215549 (16/08/2026)** — fiança reduzida, residencial, Cuiabá/MT,
aluguel R$ 2.000,00, 30 meses, transmitida só para a Porto. Voltou
`codigoStatus 12`, "Pre-Aprovado", `msg: "Necessária biometria facial para
contratação"`, `codigoAnalise 000000018577766`. É a análise a que os itens
1.6, 3.4.1 e 4.8 se referem.

---

## 1. Bloqueiam o início dos testes

**1.1 Credencial de homologação** ✅ **resolvido**
Recebida em 13/08/2026 e testada com sucesso.

**1.2 Webhooks** ⚠️ *virou bloqueio*
Duas coisas aqui: o **cadastro** das URLs do nosso lado, que é o que trava
hoje, e a **autenticação** delas, que é a discussão de segurança.

*Cadastro — é o que precisamos primeiro.* Nenhum webhook nosso foi acionado
até agora (zero recebidos desde 13/08). Precisamos que estas três URLs sejam
cadastradas para a nossa integração:

```
https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/<segredo>/analise
https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/<segredo>/biometria
https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/<segredo>/arquivos
```

O `<segredo>` vai por canal separado — ver a pergunta sobre segredo no
caminho, logo abaixo. As três respondem `{"success":"1"}`, como a
documentação pede.

Por que isso virou bloqueio: **o link da biometria só existe no webhook**.
Medimos — o `GET /apiFiancaAnalise/{id}` devolve `statusBiometria` mas nunca
`linkBiometria` (ver 3.4.1). Sem o webhook cadastrado não há caminho para o
link chegar até o corretor, a análise fica parada em pré-aprovado e a
contratação não chega a ser testada.

*Autenticação.* A documentação lista apenas `Content-Type: application/json`
nos webhooks de análise, biometria e arquivos — sem assinatura, HMAC ou token.

Do nosso lado tratamos isso não confiando no corpo da requisição: usamos o
webhook apenas como aviso de mudança e reconsultamos o estado com nosso token.
Ainda assim, gostaríamos de fechar mais:

- Vocês aceitam que a URL cadastrada contenha um segredo no caminho?
  Ex.: `https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/<segredo>/analise`
- Qual a faixa de IPs de origem dos webhooks, para restringirmos?
- Qual a política de retentativa? Quantas vezes e em que intervalo?

**1.3 Sigla da Porto Seguro** ✅ **resolvido pela própria API**
`GET /apiFiancaAnalise/seguradorasAnalise` devolve
`{"seguradora":"Porto","sigla":"por"}`. Adotamos **`por`** como valor canônico e
migramos os registros antigos. Continuamos aceitando `porto` na entrada, por
segurança.

**1.4 Ambiente**
Confirmamos o entendimento: produção e homologação usam a **mesma URL**, e o que
separa as duas é o campo `ambiente` no corpo (1 = produção, 2 = homologação).
Está correto?

**1.5 Habilitação por seguradora** ⚠️ *novo*
O `consultarImobiliaria` do CNPJ de teste devolve, além do cadastro:

```json
"porto_fianca": true,  "too_fianca": false,
"tokio_fianca": false, "pottencial_fianca": false,
"porto_incendio": true, "alfa_incendio": true, "yelum_incendio": false
```

Esses campos não constam na documentação. Entendemos que indicam **em quais
seguradoras aquela imobiliária está habilitada a cotar** — o que muda o
comportamento da nossa tela.

**Testamos em 15/08/2026 (análise `215528`).** Transmitimos para a **Too**, que
o CNPJ de teste tem como `too_fianca: false`. O resultado preocupa:

- a análise **foi aceita** — recebeu id e ocupou numeração;
- o retorno veio com `"codigoStatus": 0` e `descricaoStatus` **vazio**;
- o `GET /apiFiancaAnalise/215528` devolve a análise com **zero pareceres**.

Ou seja: não há erro, e também não há resposta. Do lado do corretor isso é uma
análise que fica parada para sempre, sem nada que explique o motivo — e ele não
tem como saber que a seguradora não estava habilitada.

**Já implementamos o filtro** (16/08): a lista de seguradoras é resolvida no
servidor e nunca vai vazia, cruzando essas flags com o campo `analiseReduzida`
do `seguradorasAnalise`. Descobrimos o segundo critério do jeito difícil —
omitir `seguradorasAnalise` significa "todas" para a API, e "todas" inclui a
Tokio, que não aceita análise reduzida; a validação dela estoura em **500
genérico e derruba junto as outras três**, que teriam cotado. Pedida sozinha,
a Tokio recusa corretamente, com motivo. Vale conferir esse tratamento do lado
de vocês.

Restam as perguntas:

- O entendimento sobre os campos está certo?
- **Confirmam que devemos filtrar** a lista de seguradoras oferecidas por esses
  campos? Pelo que medimos, é o que evita a análise natimorta — só queremos o
  aval de vocês antes de esconder seguradora de quem talvez pudesse cotar.
- O `codigoStatus: 0` nesse caso significa especificamente "seguradora não
  habilitada", ou é o código genérico de erro sem detalhe?
- Uma imobiliária nova, cadastrada via `cadastrarImobiliaria`, nasce habilitada
  em quais? Quem liga as demais, e como pedimos?

*(No `yelum_incendio` aparece uma seguradora — Yelum — que não está em nenhuma
das listas de disponíveis. Ela entra em algum momento?)*

**1.6 Habilitar as demais seguradoras** ✅ *resolvido em 28/08/2026 — por outro caminho*
Consequência direta do 1.5: com `porto_fianca` como única habilitação ativa, o
CNPJ de teste só permite exercitar **uma** das quatro seguradoras. Três quartos
da integração de fiança seguem sem cobertura de teste — e o comportamento
delas hoje, se insistirmos, é análise natimorta, sem erro.

**Pedido:** habilitar `too_fianca`, `tokio_fianca` e `pottencial_fianca` no
CNPJ `10.961.528/0001-80`, em homologação.

O que isso destrava do nosso lado: comparação de pareceres entre seguradoras na
mesma análise (que é o produto que estamos construindo), o caminho da Tokio com
análise completa, e a validação de que o filtro do 1.5 está correto — hoje não
temos como distinguir "filtrou certo" de "só existe uma opção".

**Resolvido de outro jeito.** Vocês não habilitaram no CNPJ de teste: habilitaram
na **IMOBILIATTO** (`45.528.182/0001-06`), avisada em 28/08 como *"ficou certo
para sua imobiliária"*. Medido em 30/08 no `consultarImobiliaria` de
homologação — `porto_fianca`, `too_fianca`, `tokio_fianca` e
`pottencial_fianca` **todas true**, mais `porto_incendio` e `alfa_incendio`.
O CNPJ de teste segue com só a Porto.

Serve igual: passamos a cotar sob o CNPJ da imobiliária em homologação, com o
de teste como rede para quem não tem cadastro na base de vocês. Só confirmem
que a habilitação foi intencional.

---

## 2. Bloqueiam o modelo comercial

**O modelo que pretendemos** é de comissão sobreposta (*override*):

- cada imobiliária que operar pela plataforma **continua recebendo a comissão
  dela**, normalmente, como se tivesse cotado direto;
- o AluguelCuiabá recebe **uma fatia sobre o volume originado** através da
  plataforma;
- vocês seguem fazendo negócio direto com quem não usa a plataforma.

As perguntas abaixo decorrem disso.

**2.1 A credencial recebida é de plataforma ou de imobiliária?** ⚠️
Recebemos `api.aluguelcuiaba@maximizaseguros.com.br` e ela autentica — o JWT traz
`{"id":"101","typeUser":1}`. **O que `typeUser: 1` significa?**

O que precisamos saber é se ela nos permite **cadastrar e operar várias
imobiliárias** via `cadastrarImobiliaria` (credencial de plataforma /
integrador), ou se é uma credencial de imobiliária única. Dado o modelo de
override acima, ela precisa ser de plataforma: com credencial de imobiliária, as
análises de todos os corretores apareceriam como sendo da nossa e o modelo de
comissão não se sustenta.

Confirmem também se esta é de **homologação**, e como pedimos a de **produção**
quando os testes fecharem.

**2.2 Como a originação é marcada?** ⚠️
A comissão do corretor sai pelo CNPJ dele — isso está claro. Mas **qual campo
registra que a análise passou pelo AluguelCuiabá?**

É o `corretora: "99"` que aparece no webhook? São os `cod_alfa` / `cod_porto`
que voltam no `consultarImobiliaria` e não constam na documentação?

Sem um identificador de canal, não temos como auditar a nossa própria
remuneração.

**2.3 Imobiliárias que já são clientes de vocês** ⚠️ *decide nossa estratégia*
Uma imobiliária que **já tem cadastro** na Maximiza e passa a operar pela
plataforma — a originação passa a ser nossa, ou o override só vale para
imobiliárias novas, cadastradas via API?

E o nosso próprio cadastro (IMOBILIATTO, hoje direto): migra para debaixo da
plataforma?

A resposta muda completamente quem prospectamos.

**2.4 Janela de atribuição**
Se a cotação nasce na plataforma e a contratação é concluída por outro canal
(WhatsApp com o gerente de vocês, por exemplo), a originação continua nossa? Por
quantos dias?

E o inverso — cotação feita no painel de vocês e depois registrada na
plataforma — conta?

**2.5 Remuneração do override**
- Percentual ou valor fixo por apólice originada pela plataforma?
- Incide sobre o prêmio ou sobre a comissão da imobiliária?
- Percentual ou valor fixo por apólice emitida, por seguradora?
- A base de cálculo é o prêmio líquido ou bruto (IOF e custo de apólice entram)?
- Prazo de pagamento após a emissão?
- Regra de estorno em caso de cancelamento — integral ou proporcional?
- Existe comissão de renovação? Por quantos anos?

**2.6 Estrutura jurídica do pagamento**
Precisamos de registro SUSEP para receber, ou o pagamento é feito como
prestação de serviço de tecnologia? Quem emite nota para quem?

---

## 3. Necessários para a interface ficar correta

**3.1 Diferença entre os planos**
`consultarPrecosApi` retorna `plano_basico`, `plano_completo` e
`plano_tradicional`. **O que muda em cobertura entre eles?** Existe uma tabela
comparativa que possamos exibir ao corretor?

**3.2 Campos `danos` e `multa`**
A documentação é ambígua: a tabela de campos descreve `danos` como "Danos ao
imóvel — 1 para sim ou 0 para não" e `multa` como "Multa — 1 para sim ou 0 para
não", mas o exemplo de JSON envia ambos como valores numéricos junto a
`condominio: 500` e `agua: 100`.

**São flags (1/0) ou valores em reais?**

**3.3 Status 4 — "Pendente/Problema na análise"**
O que o corretor deve fazer quando recebe esse status? Existe ação do lado dele
ou é resolvido internamente por vocês?

**3.4 Contradição na descrição dos status** ⚠️ *confirmação final*
As páginas 9 e 10 do PDF dizem "Aprovado(1), Reprovado(2), Em Análise(3)", mas a
tabela oficial da página 23 (e o OpenAPI) dizem `2 = Em Análise` e
`3 = Recusado`. Estamos seguindo a tabela e lendo sempre o `codigoStatus`, nunca
o `descricaoStatus`.

Com a regra da biometria que vocês passaram, o mapa que implementamos é este —
**confirmem os códigos**, já que é ele que decide quando a contratação abre:

| Código | Significado | Contratação |
|---|---|---|
| 2 | Em análise | bloqueada |
| 12 | Pré-aprovado (falta biometria) | **bloqueada** |
| 1 | Aprovado (pós-biometria) | liberada |
| 5 | Aprovado com limite inferior | liberada |
| 3 | Recusado | bloqueada |

**Pergunta:** o `5` (limite inferior) também só aparece depois da biometria, ou
ele pode sair já na análise financeira?

**3.4.1 A biometria: o link e o fim dela** ⚠️ *bloqueia o teste de contratação*

*O link.* Medimos na análise 215549: o `GET /apiFiancaAnalise/{id}` devolve
`"statusBiometria": 0` e a mensagem "Necessária biometria facial para
contratação", mas **não devolve `linkBiometria`**. Entendemos, então, que o
link só trafega no webhook de biometria. Confirmam? Se houver outro endpoint
que o recupere, é o que precisamos — hoje o corretor vê que falta biometria e
não tem o que mandar para o inquilino.

*Concluir a biometria em homologação.* Existe algum caminho de teste? Um CPF
que conclua automaticamente, um endpoint que force o resultado, ou o link de
homologação abre um fluxo real que dá para percorrer? **É o que trava o teste
de `/contratar`** — sem chegar ao status 1, a contratação nunca abre e não
conseguimos exercitar emissão, webhook de arquivos nem número de apólice.

*O fim dela.* O webhook de biometria avisa a mudança, mas o parecer novo
(12 → 1) chega no webhook de análise ou precisamos consultar? Hoje
reconsultamos a análise a cada webhook, então funciona nos dois casos — é só
para sabermos o esperado.

**3.9 O campo `corretor` no eco da análise** ⚠️ *novo*
O `GET /apiFiancaAnalise/215549` devolve, dentro de `dadosAnalise`:

```json
"imobiliaria": { "cnpj": "10.961.528/0001-80", "corretor": "10" }
```

O `corretor` não é campo que enviamos e não consta na documentação. O que ele
identifica? Perguntamos porque pode ser justamente o marcador de canal que
falta para o item 2.2 — o que registra que a análise passou pelo AluguelCuiabá.

**3.5 Campos de empresa**
`tipo_empresa`, `opcao_tributaria_empresa` e `capital_social_empresa` aparecem no
PDF sob o bloco "ROOT / RESIDENCIA" e não constam no OpenAPI. Onde exatamente
entram no JSON?

**3.6 Seguradora Junto**
O painel de vocês lista a Junto junto às outras quatro, mas sem o selo "API".
Ela é cotável pela integração ou é atendimento manual? Por ora deixamos fora.

**3.7 Emissão da apólice**
O retorno de `/contratar` traz apenas uma mensagem, sem número de apólice.
Confirmam que a apólice chega depois pelo webhook de arquivos com
`codigoDescArquivo = 9`? Existe algum retorno com o número em si?

**3.8 Cartão de crédito**
O endpoint `/contratar` aceita número, validade e titular do cartão. Trafegar
esses dados pelo nosso servidor nos colocaria no escopo do PCI-DSS, o que
queremos evitar.

**Vocês oferecem link de pagamento ou tokenização de cartão?** Se não, vamos
oferecer apenas fatura, boleto e ficha — e o corretor conclui por cartão pelo
canal de vocês.

---

## 4. Operação e atendimento

**4.1** Qual o prazo médio entre a transmissão e o parecer?

**4.2** Qual a taxa de aprovação histórica no perfil "locação residencial,
Cuiabá"?

**4.3** Qual o motivo mais comum de recusa?

**4.4** Quem é o "atendente" das análises originadas pela nossa integração?
Teremos um analista designado?

**4.5** ⚠️ **Sinistro:** quando o inquilino não paga, **quanto tempo até o
proprietário receber?** Essa é a primeira pergunta que todo proprietário faz, e
precisamos saber responder.

**4.6** Rate limit da API — quantas requisições por minuto?

**4.8** ⚠️ **Tempo de resposta do `transmitirAnalise`, e uma análise órfã.**
*novo, e tem uma parte que é pedido*

Na análise 215549 a chamada levou **56,2 segundos** até responder. Nosso
cliente tinha teto de 30s por tentativa, então a primeira tentativa foi
abortada e a **segunda** é que trouxe o resultado.

O problema é que a primeira não morreu no caminho: ela chegou até vocês e foi
processada. Ou seja, é bem provável que exista uma **análise órfã** criada por
ela, poucos minutos antes da 215549, no CNPJ `10.961.528/0001-80` — com número
próprio, que nós nunca soubemos qual é.

- **Pedido:** localizar e descartar essa análise, para não poluir a base de
  homologação nem a contagem de vocês.
- Qual é o tempo **esperado** de resposta do `transmitirAnalise`? Existe teto?
- Existe **modo assíncrono** — responder o id imediatamente e mandar o parecer
  pelo webhook de análise? É o desenho que resolveria isto de vez.

Por que perguntamos: nossa aplicação roda em plataforma com limite de **60
segundos** por requisição. Uma transmissão de 56s passa raspando; qualquer
análise mais lenta que isso é interrompida pela plataforma antes de vocês
responderem, e nem o corretor nem nós saberíamos o que houve.

Do nosso lado já tratamos: chamadas que criam registro (`transmitirAnalise`,
`transmitirReanalise`, `contratar`, `cadastrarImobiliaria`, `cancelar`) não são
mais repetidas automaticamente — repetir, nesses casos, produz duplicata em vez
de reparo.

**4.7** Existe SLA de disponibilidade? Quem é o contato técnico em caso de
indisponibilidade?

---

## 5. Jurídico e dados

**5.1** Na relação, quem é controlador e quem é operador dos dados do inquilino
(LGPD)?

**5.2** Existe DPA (acordo de tratamento de dados) padrão? Podemos ver antes de
assinar?

**5.3** O texto de consentimento que exibimos ao inquilino precisa de alguma
redação específica de vocês? Hoje usamos:

> *"Autorizo o envio dos meus dados à corretora e às seguradoras parceiras para
> análise do seguro fiança, incluindo consulta a órgãos de proteção ao crédito."*

**5.4** Em caso de incidente de segurança do lado de vocês, quem notifica a ANPD
e os titulares?

**5.5** Se exibirmos uma cotação incorreta por falha de integração, de quem é a
responsabilidade perante o segurado?

---

## 6. Marca e expansão

**6.1** Podemos exibir a marca de vocês e das seguradoras na plataforma? Existe
manual de marca?

**6.2** Vocês aceitam integração white-label (o corretor vê "Seguro Fiança" com a
nossa marca)? Isso altera a comissão?

**6.3** Vocês divulgariam a plataforma para a base de corretores de vocês em
Cuiabá? Quantos corretores/imobiliárias vocês atendem na praça?

**6.4** Há pedido de exclusividade? Se sim, o que é oferecido em contrapartida?

**6.5** Se levarmos a plataforma para Várzea Grande, Rondonópolis ou outro
estado, a parceria acompanha com a mesma tabela?

---

## 7. Seguro incêndio

Recebemos a documentação (Incêndio V2) e a integração já está construída.
Pontos a confirmar:

**7.1** ✅ Confirmado contra a API: `listarSeguradorasDisponiveis` devolve
exatamente `["Alfa","Porto"]`. Há previsão de outras?

**7.0 O que medimos no `/calculo` em 16/08/2026** ⚠️ *novo*

Rodamos o cálculo nas duas seguradoras, variando um campo por vez. As
diferenças entre elas não estão documentadas e cada uma derrubava a cotação de
um jeito:

**a) `ambiente` precisa ser texto no incêndio.** Na fiança número funciona;
aqui a Alfa recusa.

```
"ambiente": 2     ->  400  "ambiente inválido"
"ambiente": "2"   ->  201  cotação normal
campo ausente     ->  201  cotação normal
```

O terceiro caso é o que incomoda: **sem o campo a cotação também passa**, e não
há como saber em que ambiente ela foi processada. Qual é o padrão quando
`ambiente` não é informado? Passamos a enviar sempre, explícito. A Porto não
valida o campo em nenhum formato.

**b) A Alfa exige nome e sobrenome** de segurado e beneficiário. Nome de uma
palavra volta `"Nome Segurado Inválido<br/>Nome Beneficiário Inválido<br/>"`.
Passamos a barrar no formulário, com mensagem que diz o que corrigir.

**c) A Porto exige o endereço já no cálculo** (`endereco_seguro não
informado`), enquanto a Alfa calcula só com CEP e UF. Passamos a mandar o
endereço completo nas duas.

**d) A Porto exige `vl_cob_conteudo` maior que zero mesmo com
`tipo_cobertura: 3`** (somente prédio), e trata zero como campo não informado.
**Isso é esperado?** Que valor devemos enviar quando o seguro não cobre
conteúdo?

**e)** Confirmado que os catálogos de ocupação e de assistência são **por
seguradora** e não se misturam — `4070/1002` (Apartamento habitual, Alfa) é
inválido na Porto, que usa `1/6` (APARTAMENTOS). Já tratávamos assim; fica
registrado porque não está escrito em lugar nenhum.

**7.2** No painel, a coluna "Pró-labore %/R$" mostra **20%** do prêmio nas
apólices de incêndio. Esse percentual é fixo, varia por seguradora, ou é
negociado por imobiliária? A API não devolve esse valor — hoje exibimos como
estimativa.

**7.3** A parcela mínima é **R$ 60,00**, como consta no painel? E o teto de 6
parcelas do campo `qtpar` vale para as duas seguradoras?

**7.4** O painel diferencia "Seguros com Adm. Imobiliária" de "Seguros SEM
Administração — Estipulante Particular". Como essa distinção é feita pela API?

**7.5** O `codigo_seguro` é a chave para cancelar e imprimir. Existe forma de
recuperá-lo depois, caso se perca? Há endpoint de consulta por CPF ou por
proposta?

**7.6** Cancelamento: há prazo limite? Gera estorno proporcional do prêmio e da
comissão?

**7.7** Renovação: apólice anual vencendo — existe endpoint de renovação, ou o
caminho é contratar uma nova?

---

## 8. Para entrar em produção

Checklist do que precisamos de vocês para ligar:

- [x] Credencial de **homologação** — recebida em 13/08/2026 e testada
- [x] **Habilitar Too, Tokio e Pottencial** (1.6) — feito em 28/08 na
      IMOBILIATTO, não no CNPJ de teste; medido em 30/08
- [ ] **URLs de webhook cadastradas** do lado de vocês (1.2) — *destrava a
      biometria e, com ela, a contratação*
- [ ] **Caminho para concluir biometria em homologação** (3.4.1)
- [ ] Credencial de **produção** (separada da de homologação)
- [ ] Contrato de parceria assinado
- [ ] Tabela de comissionamento definida
- [ ] DPA / acordo de tratamento de dados
- [ ] Autorização de uso de marca
- [ ] Contato técnico e contato comercial nomeados

---

*Documento gerado a partir da análise de `api.fianca.pdf` (v1, 24 páginas),
`api.imobiliaria.pdf` (v1) e da especificação OpenAPI 3.0 fornecida.*

*Atualizado em 16/08/2026 com a análise 215549 e o que ela mediu: o link da
biometria não vem no GET (3.4.1), o tempo de 56s na transmissão e a provável
análise órfã (4.8), o campo `corretor` no eco (3.9) e o pedido de habilitação
das demais seguradoras no CNPJ de teste (1.6).*
