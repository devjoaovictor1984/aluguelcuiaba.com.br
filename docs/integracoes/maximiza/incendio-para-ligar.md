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

## O que pedimos, em uma linha

**As URLs de webhook**, que seguem sem cadastro desde 18/08 — é o único
bloqueio que sobrou, e ele é da fiança. No incêndio, o que falta é a
credencial de produção e o pró-labore confirmado.

---

*Gerado a partir de `diario-de-homologacao.md`, onde cada medição citada aqui
tem data, payload e resposta.*
