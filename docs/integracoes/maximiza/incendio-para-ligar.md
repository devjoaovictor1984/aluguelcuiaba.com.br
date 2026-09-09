# Seguro incêndio — o que falta pra ligar

*AluguelCuiabá × Maximiza · 30/08/2026, revisto em 08/09/2026*

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

**1.2** Do nosso lado, a cotação passou a sair sob o CNPJ da IMOBILIATTO em
vez do CNPJ de teste. Foi o que expôs o item 1.3 abaixo — e, com ele, o fato
de que essas flags descrevem o cadastro, não o ambiente em que ele coteja.

Continua faltando, e é o que trava a fiança: **as URLs de webhook não estão
cadastradas.** Nenhum webhook chegou desde 13/08. Sem elas o link da
biometria nunca chega, a análise fica em pré-aprovado para sempre e a
contratação de fiança nunca abre. Foram entregues em 18/08.

---

## 1.3 RESOLVIDO — era ambiente, não cadastro

Ficou dez dias como o item mais urgente daqui. Em 08/09/2026 vocês
responderam:

> *"Favor testar em modo produção. Essa credencial para cálculo incêndio Alfa
> é somente em modo produção."*

Testamos, e é isso. O mesmo payload, mudando só o campo `ambiente`:

```
ambiente 1 (produção)      ambiente 2 (homologação)
──────────────────────     ────────────────────────
Alfa  · IMOBILIATTO  201   Alfa  · IMOBILIATTO  400
Alfa  · CNPJ teste   400   Alfa  · CNPJ teste   201
Porto · IMOBILIATTO  201   Porto · IMOBILIATTO  400
```

A tabela inverte inteira: cada CNPJ está provisionado no seu ambiente, e o
400 era nós batendo no ambiente errado. Prêmio idêntico dos dois lados —
364,71, com as mesmas 6 coberturas.

Fica registrado só para quem vier depois não repetir a investigação: **o
`consultarImobiliaria` não tem campo `ambiente`**, então ele respondia 201 com
todas as flags `true` mesmo quando o cálculo naquele ambiente ia falhar. Não
dá para usar a consulta como prova de que a cotação vai passar.

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

- [x] **Credencial de produção** — a mesma do login; o que muda é o campo
      `ambiente` do corpo. Medida no cálculo em 08/09 (item 1.3)
- [x] **Pró-labore do incêndio: 20%, confirmado.** O detalhamento da apólice
      607987 no painel deles traz "% Pró-labore Imobiliária: 20" em campo
      próprio, para a IMOBILIATTO. Continua sem vir na API — seguimos
      exibindo como estimativa —, mas o número deixou de ser leitura de
      coluna e virou dado da apólice. Falta só saber se varia por seguradora
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

1. **Dizer como escolher a seguradora agora** (item 1.4) — o header parou de
   funcionar e não achamos substituto. Em produção isso pesa mais: o corretor
   escolhe, recebe preço e contrata sem saber de qual seguradora ele é.
2. **Cadastrar as URLs de webhook** (entregues em 18/08) — é o que trava a
   fiança inteira; nenhum webhook chegou desde 13/08.
3. **O pró-labore confirmado** e o resto do item 2, pra ligar o incêndio de
   verdade.
4. **A fiança também é só em produção?** O cálculo de incêndio era; se valer
   igual para a fiança, dizer antes — transmitir análise em produção cria
   proposta real, e não fazemos isso por conta própria.

---

*Gerado a partir de `diario-de-homologacao.md`, onde cada medição citada aqui
tem data, payload e resposta.*
