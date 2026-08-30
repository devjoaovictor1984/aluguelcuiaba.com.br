# Seguro incêndio — o que falta pra ligar

*AluguelCuiabá × Maximiza · 30/08/2026*

Este documento é só de **incêndio**. As pendências de fiança seguem em
`perguntas-pendentes.md` e não bloqueiam nada aqui: o que restou lá —
biometria e webhook — é de fiança.

---

## Onde o incêndio está

Fechado ponta a ponta em homologação desde 18/08/2026:

```
cálculo  →  contratação  →  certificado e proposta  →  cancelamento
```

Apólice `607773` (Alfa, `numero_proposta 1659097`) foi emitida e cancelada pela
própria API. Cálculo funciona na Alfa e na Porto. Sobra o boleto, que depende do
fechamento do lote de vocês, não de nós.

**Não falta código.** O que falta são as respostas abaixo.

---

## 1. Confirmado: habilitaram em homologação, e mais do que pediram

> *"Ficou certo para sua imobiliária. Poderia testar o cálculo de incêndio?"*
> — 28/08/2026, 17:54

Consultamos em vez de perguntar — `consultarImobiliaria` não cria registro.
Com a credencial de homologação, o CNPJ da IMOBILIATTO
(`45.528.182/0001-06`) responde 201:

```
razao   J. V. VIEIRA LTDA        fantasia  IMOBILIATTO
cod_alfa 5719                    cod_porto 60132
porto_incendio true    alfa_incendio     true
porto_fianca   true    too_fianca        true
tokio_fianca   true    pottencial_fianca true
```

Duas coisas que vale confirmar com vocês:

**1.1** Habilitaram **as quatro seguradoras de fiança**, não só incêndio. O
item 1.6 das pendências pedia isso no CNPJ de teste
(`10.961.528/0001-80`, onde só `porto_fianca` está ligada) e vocês
resolveram na imobiliária — serve igual, e agradecemos. Confirmem que é
intencional, porque muda o que passamos a exercitar na fiança.

**1.2** Do nosso lado, a cotação em homologação passou a sair sob o CNPJ da
IMOBILIATTO em vez do CNPJ de teste. **O cálculo de incêndio que vocês
pediram já pode rodar** — é o que vamos fazer.

Continua faltando, e é o que trava a fiança: **as URLs de webhook não estão
cadastradas.** Nenhum webhook chegou desde 13/08. Sem elas o link da
biometria nunca chega, a análise fica em pré-aprovado para sempre e a
contratação de fiança nunca abre. Foram entregues em 18/08.

---

## 1.3 URGENTE — o cadastro da IMOBILIATTO não coteja

Assim que passamos a cotar sob a IMOBILIATTO, toda cotação passou a voltar:

```
400  Erro em EnviaCertificadoXML. Contacte o Administrador.
     Erro: Usuário e/ou Senha Inválidos! Tente novamente ou contate Sistemas.
```

Isolamos mandando o **mesmo payload** e trocando só o `cpfcnpj_imob`:

```
Alfa  · 45528182000106 (IMOBILIATTO)  → 400  "Usuário e/ou Senha Inválidos!"
Alfa  · 10961528000180 (teste)        → 201  prêmio 251,69
Porto · 45528182000106 (IMOBILIATTO)  → 400  "Usuário e/ou Senha Inválidos!"
Porto · 10961528000180 (teste)        → 201  prêmio 364,71
```

Falha nas duas seguradoras, então não é credencial de uma delas. E não é a
nossa credencial: a autenticação passa e o erro é de regra de negócio.

O `consultarImobiliaria` responde 201 para a IMOBILIATTO, com `cod_alfa
5719`, `cod_porto 60132` e todas as flags `true`. **O cadastro existe mas
parece não ter as credenciais das seguradoras provisionadas em
homologação** — as flags não refletem isso.

**É o que trava os testes agora.** Enquanto isso seguimos cotando sob o CNPJ
de teste, o que exercita o fluxo mas não valida o cadastro de vocês.

---

## 1.4 URGENTE — a escolha de seguradora parou de ter efeito

Em 17/08 o header `seguradora` funcionava: a Porto exigia endereço no cálculo
e usava outro catálogo de ocupação (`1/6 APARTAMENTOS` contra `4070/1002` da
Alfa). Hoje, não.

**`ocupacoes/R`** devolve a mesma lista para seis valores de header
diferentes, incluindo um inválido e nenhum header.

**`/calculo`** faz o mesmo. Payload idêntico:

```
header seguradora = Alfa   → 201  premio 364,71 · 6 coberturas
header seguradora = Porto  → 201  premio 364,71 · 6 coberturas
header seguradora = al2    → 201  (idêntico)
header seguradora = por    → 201  (idêntico)
SEM header                 → 201  (idêntico)
```

Procuramos o roteamento novo no corpo — `seguradora`, `sigla`,
`cdseguradora`, `cia` — e nenhum muda o resultado.

**Como pedimos a cotação para uma seguradora específica agora?** Enquanto não
soubermos, o seletor da nossa tela é decorativo: o corretor escolhe Porto e
recebe um preço que não sabemos de quem é. Isso é pior do que receber erro,
porque o número parece bom.

E se a mudança for intencional, precisamos saber: a `sigla` nova (`al2`,
`por`) entra onde?

---

## 2. O que precisa estar de pé antes da primeira apólice real

Não é lista de desejos — é o mínimo pra não emitir errado:

- [ ] **Credencial de produção**, separada da de homologação
- [ ] **Pró-labore do incêndio**: a coluna "Pró-labore %/R$" do painel mostra
      **20%** do prêmio. É fixo, varia por seguradora, ou é negociado por
      imobiliária? A API não devolve esse valor — hoje exibimos como
      estimativa, e rotulado como tal
- [ ] **Cancelamento**: há prazo limite? Gera estorno proporcional do prêmio
      **e** da comissão?
- [ ] Contrato de parceria e tabela de comissionamento

---

## 3. Três coisas medidas que continuam sem resposta

Todas já contornadas do nosso lado. Ficam aqui porque o contorno é chute
calibrado, e chute em cima de preço acaba mal.

**3.1 O campo "Tabela" (1 a 20).** É obrigatório no cálculo do painel de vocês
e sai `20` por padrão. **Não existe em nenhum lugar da API que recebemos.** Se
ele mexe em preço ou em comissão, estamos cotando sempre no padrão sem saber
disso. É o que mais nos preocupa dos três.

**3.2 A Porto exige `vl_cob_conteudo` > 0 mesmo em "somente prédio"**
(`tipo_cobertura: 3`), e trata zero como campo não informado. Isso é regra ou
validação? Que valor devemos enviar quando o seguro não cobre conteúdo?

**3.3 O limite do vendaval varia com a ocupação.** Medido em 17/08:

```
comercial,    LMI 700.000:  30% → 400 "IS da Cobertura ... fora do limite"
                            25% → 201
residencial,  LMI 128.000:  30% → 201
```

Baixamos a sugestão para 25%, que passa nos dois. Qual é a regra real?

---

## 4. Duas coisas do lado de vocês, registradas

**4.1 `listaFormasPagto` volta vazia em toda cotação da Alfa** — nas duas
vigências, com e sem assistência. Como a tela só oferecia o que vinha nessa
lista, a cotação calculava e não dava pra contratar. Passamos a derivar o
parcelamento do prêmio e da parcela mínima de R$ 60,00, que é a mesma conta do
painel de vocês. Confirmem se a parcela mínima é essa e se o teto de 6 do campo
`qtpar` vale para as duas seguradoras — aí a lista da API volta a ter
preferência.

**4.2 Os três endpoints chaveados por `codigo_seguro` recusam o header
`seguradora`.** `imprimirProposta`, `imprimirBoleto` e `cancelar` devolvem
400 *"Seguro informado não pertence a seguradora Alfa"* sobre uma apólice
criada na Alfa pela própria API. Sem o header, os três passam. A documentação
pede o header em toda chamada de incêndio. Vale corrigir a doc ou a validação —
do nosso lado já está contornado.

---

## O que pedimos, em ordem

1. **Provisionar as credenciais das seguradoras no cadastro da IMOBILIATTO**
   (item 1.3) — é o que trava o teste do incêndio hoje.
2. **Dizer como escolher a seguradora agora** (item 1.4) — o header parou de
   funcionar e não achamos substituto.
3. **Cadastrar as URLs de webhook** (entregues em 18/08) — é o que trava a
   fiança inteira; nenhum webhook chegou desde 13/08.
4. Credencial de produção e o pró-labore confirmado, pra ligar o incêndio.

---

*Gerado a partir de `diario-de-homologacao.md`, onde cada medição citada aqui
tem data, payload e resposta.*
