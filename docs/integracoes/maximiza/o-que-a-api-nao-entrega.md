# O que o painel de vocês tem e a API não entrega

*AluguelCuiabá × Maximiza · seguro incêndio · 08/09/2026*

Este documento existe por um motivo específico: **a mesma cotação sai com
valores diferentes no painel de vocês e na nossa plataforma**, e queremos
mostrar exatamente onde a diferença nasce em vez de discutir no escuro.

A conclusão curta é que **não é a tarifa** — com a mesma seleção de
coberturas o total fica a 0,3% de distância. A diferença aparece nos
parâmetros que o painel de vocês controla e que a API não devolve nem aceita.

Tudo aqui foi medido contra a API de produção, sob o CNPJ da IMOBILIATTO
(45.528.182/0001-06), em 08/09/2026. Nenhum número foi reconstruído de
memória.

---

## 0. Respondido em 10/09/2026 — são dois produtos, não um

**Vocês responderam, e a resposta explica os itens 1.1 e 2 de uma vez:**

> *"O produto constante na Api é a versão 2 da Alfa. No nosso sistema tem
> ambas versões. Quanto a 'VER 007' é outra codificação interna nossa, e não
> da seguradora. A Alfa versão 1 está sendo descontinuada, por isso deixamos
> apenas a versão 2 na Api. Elas têm taxas, franquias e regras diferentes
> entre si."*

Ou seja: a apólice 607987, do painel, é **Alfa v1**; o `/calculo` da API é
**Alfa v2**. Não é divergência de tabela dentro do mesmo produto — são
produtos diferentes. Fecha a pergunta da franquia (1.1) e a das taxas por
cobertura (2), e explica a sigla `al2` que apareceu no
`listarSeguradorasDisponiveis` (item 7.1 das perguntas pendentes) — `al2` é
literalmente Alfa v2.

**Do nosso lado não muda código:** a franquia que exibimos vem do campo
`txtfranq` do próprio `/calculo`, então o cliente já vê a franquia da v2, que
é a do produto que ele está contratando. O que mudou é que paramos de tratar
a diferença como defeito.

**O que ainda precisamos, agora que sabemos o que estamos vendendo:**

1. **Condições gerais da v2** — clausulado e número do processo SUSEP. É o
   documento que o segurado tem direito de receber, e hoje não temos.
2. **Tabela de franquias e regras da v2** por cobertura, para conferirmos o
   que a tela mostra antes de emitir.
3. **Data em que a v1 é desligada.** Importa para renovação: quem tem apólice
   v1 hoje renova em v2 com **preço e franquia diferentes** (no caso medido,
   +5,1% no prêmio e franquia de 8%/R$ 200 para 10%/R$ 500). Precisamos
   avisar o cliente antes, não na hora.
4. **O pró-labore de 20% vale igual na v2?** O número confirmado veio de uma
   apólice v1.
5. **O painel de vocês vai continuar oferecendo a v1 enquanto ela existir?**
   Se sim, o mesmo corretor cota mais barato fora da plataforma que dentro —
   e isso é conversa comercial, não técnica.

---

## 1. O mesmo caso, nos dois lugares

Depois de alinharmos a nossa tela à de vocês — mesmas coberturas marcadas,
mesmos valores sugeridos — a cotação bate.

Residencial · Apartamento habitual · aluguel R$ 1.800 · anual (365 dias) ·
valor do imóvel R$ 360.000 · perda de aluguel R$ 10.800 · responsabilidade
civil R$ 36.000 · danos elétricos R$ 3.600 · sem assistência:

```
Painel de vocês    R$ 361,78
API Alfa           R$ 360,89       diferença de R$ 0,89  (0,25%)
```

E com o valor do imóvel em R$ 150.000, só as duas obrigatórias:

| | Painel (Tabela 20) | API Alfa | diferença |
|---|---|---|---|
| Incêndio, raio, explosão | 105,50 | **102,98** | −2,52 |
| Perda ou pagamento de aluguel | 8,93 | **11,81** | +2,88 |
| **Prêmio líquido** | **114,43** | **114,79** | **+0,36** |

O total praticamente bate nos dois testes. **A composição, não** — e é o que
o item 2 detalha.

---

## 1.1 A franquia sai diferente — e franquia não é arredondamento

Comparação com a apólice **607987** do painel (orçamento 285667, transmitida
em 18/08/2026, versão 007), contra a mesma cotação pela API. Valores
segurados idênticos, sem assistência nos dois lados:

```
                         Painel (apólice 607987)          API Alfa
Incêndio    150.000   8% com mínimo de R$ 200,00   10% com mínimo de R$ 500,00
Danos elétr.  3.600   8% com mínimo de R$ 200,00   10% com mínimo de R$ 500,00
Perda aluguel 2.000   sem franquia                 sem franquia
Resp. civil  36.000   sem franquia                 sem franquia

Prêmio líquido              R$ 173,45                    R$ 182,31
IOF                         R$  12,80                    R$  13,45
TOTAL                       R$ 186,25                    R$ 195,76
                                                    diferença R$ 9,51 (5,1%)
```

**A franquia é cláusula contratual, não arredondamento.** Quando ela muda
junto com a taxa, o mais provável é que os dois lados estejam cotando
produtos, versões ou tabelas diferentes da mesma seguradora — e aí o cliente
vê dois preços E duas franquias para o mesmo seguro.

O detalhamento da apólice mostra um campo **"Versão: 007"** que não existe em
lugar nenhum da API. Pode ser exatamente essa a chave.

**Pergunta:** em que produto/versão/tabela o `/calculo` coteja, e como pedimos
o mesmo que o painel usa?

> **Respondido em 10/09/2026:** painel = Alfa v1, API = Alfa v2, produtos
> distintos com franquias e regras próprias. A v1 está sendo descontinuada.
> Ver item 0.

---

## 2. As taxas divergem, e nos dois sentidos

A coluna "Taxa" do painel de vocês contra a taxa efetiva da API (prêmio ÷
LMI — a API não devolve taxa, ver item 3.2):

| Cobertura | Taxa no painel | Taxa efetiva da API | razão |
|---|---|---|---|
| Incêndio | 0,07033% | 0,06865% | 0,98× |
| Perda de aluguel | 0,0827% | 0,1094% | 1,32× |
| Vendaval | 0,596% | 0,2656% | 0,45× |
| Responsabilidade civil | 0,1117% | 0,0455% | 0,41× |
| **Danos elétricos** | **0,7247%** | **1,6881%** | **2,33×** |

**Não é prêmio mínimo.** Variando só o limite de danos elétricos, mantendo
todo o resto igual:

```
LMI  3.600  → prêmio  60,77   taxa 1,6881%
LMI  7.200  → prêmio 121,54   taxa 1,6881%
LMI 14.400  → prêmio 243,08   taxa 1,6881%
LMI 28.800  → prêmio 486,15   taxa 1,6880%
LMI 45.000  → prêmio 759,61   taxa 1,6880%
```

Perfeitamente linear em todos os pontos. A taxa é essa mesmo.

**Pergunta:** em que tabela o `/calculo` coteja? E por que a taxa por
cobertura difere da Tabela 20 para mais em duas e para menos em duas?

> **Respondido em 10/09/2026:** porque a Tabela 20 é da **v1** e a API cota a
> **v2** — taxas diferentes por produto, não por erro de tabela. Ver item 0.
> Segue valendo o pedido da tabela de taxas da v2, para conferência.

---

## 3. O que a API devolve — a lista inteira

Para não haver dúvida sobre o que temos em mãos.

### 3.1 Catálogos

| Endpoint | Campos | Quantidade |
|---|---|---|
| `listarSeguradorasDisponiveis` | `seguradora`, `sigla` | 2 (Alfa `al2`, Porto `por`) |
| `ocupacoes/R` | `nome`, `rubrica`, `cdresp2` | **4** |
| `ocupacoes/C` | `nome`, `rubrica`, `cdresp2` | 73 |
| `listaPacotesAssist24hs` | `codigo`, `tipo`, `descricao` | 5 por vigência |

### 3.2 O cálculo

```
premio · vlpreliq · vliof · vlassist · cdsequencia · mensagem
listaFormasPagto[]        (vem SEMPRE vazia na Alfa)
coberturas[] → cdcob · nmcobert · lmi · premio · txtfranq
```

**Não existe campo de taxa.** A taxa que a nossa tela mostra é calculada por
nós, dividindo o prêmio pelo LMI.

### 3.3 Cadastro, contratação e documentos

`consultarImobiliaria` devolve o cadastro completo com `cod_alfa`,
`cod_porto` e as flags por seguradora. `contratar` devolve `codigo_seguro` e
`numero_proposta`. `imprimirProposta`, `imprimirBoleto` e `cancelar`
funcionam.

**Essa parte está completa e não é o problema.**

---

## 4. O que o painel de vocês tem e a API não dá

### 4.1 O campo "Tabela" (1 a 20) — não existe

É obrigatório no painel de vocês e sai com 20 por padrão. Testamos seis
nomes plausíveis no corpo do `/calculo`, cada um com valor 20 e com 1:

```
tabela · cod_tabela · nr_tabela · tabela_preco · cdtabela · id_tabela
```

**Nenhum move um centavo.** A API aceita o campo desconhecido e ignora.

Como o cálculo sem tabela nenhuma dá 114,79 contra os 114,43 da Tabela 20, o
padrão dela parece ser a 20 ou muito próximo. **O que as tabelas 1 a 19 fazem
continua sem resposta** — e se alguma for mais barata, estamos cotando caro
sem saber disso.

### 4.2 A taxa de cada cobertura

O painel mostra. A API não devolve. É o item 2 acima.

### 4.3 O botão "Sugerir valores"

A conta não vem na API. Levantamos observando o painel, e passamos a usar a
mesma — mas é leitura nossa, não regra confirmada:

```
valor do imóvel (= limite de incêndio)  =  aluguel ÷ 0,5%   (× 200)
perda de aluguel                        =  6 aluguéis
responsabilidade civil                  =  10% do valor do imóvel
danos elétricos                         =   1% do valor do imóvel
vendaval                                =  ?  (não observado)
```

Conferido com aluguel de R$ 1.800: o painel preenche R$ 360.000 de incêndio
e R$ 10.800 de perda de aluguel, e ao marcar as opcionais sugere R$ 36.000 de
responsabilidade civil e R$ 3.600 de danos elétricos.

**Pedido:** confirmem a fórmula (e a do vendaval, que não vimos), ou nos deem
um endpoint que devolva os valores sugeridos. O limite de incêndio é o que
manda no prêmio — enquanto for leitura nossa, uma mudança no painel de vocês
nos deixa para trás sem ninguém perceber.

### 4.4 O cálculo inverso

O painel tem o campo. A API não tem equivalente.

### 4.5 Duas ocupações residenciais que só existem no painel

O painel oferece seis:

```
Apto habitual · Apto veraneio com porteiro · Casa habitual ·
Casa em condomínio fechado · Casa veraneio com caseiro ·
Casa veraneio em condomínio fechado
```

O `ocupacoes/R` devolve quatro:

```
Apartamento habitual (4070/1002) · Apartamento veraneio (4080/1002) ·
Casa Habitual (4000/1001) · Casa Veraneio (4010/1001)
```

Faltam **casa em condomínio fechado** e **casa veraneio em condomínio
fechado** — e casa em condomínio fechado é caso comum aqui em Cuiabá. Como a
ocupação entra na tarifa, é preço que não temos como pedir.

### 4.6 As formas de pagamento

`listaFormasPagto` volta **vazia em toda cotação da Alfa** que fizemos, nas
duas vigências, com e sem assistência. Derivamos o parcelamento do prêmio com
parcela mínima de R$ 60,00 — a mesma conta que o painel de vocês mostra.
Confirmem que a lista vazia é definitiva, ou o que precisamos enviar para ela
vir preenchida.

### 4.7 A assistência "Plano 1 · R$ 9,12"

O print do painel mostra *"Assistência 24hrs. R$ 9,12 Plano 1"*. Os cinco
pacotes que a API devolve para vigência anual, com o preço que cada um
adiciona ao prêmio:

```
 8  Sem Assistência                                    R$  0,00
 9  Assist Light                                       R$ 13,56
10  Assist Light e Linha Branca                        R$ 19,08
11  Assist Light, Linha Branca e Linha Marrom          R$ 42,00
12  Assist Imob 4                                      R$ 39,60
```

**Nenhum é R$ 9,12.** Qual pacote é o "Plano 1", e como o pedimos?

### 4.8 O teto das coberturas acessórias

Não está documentado em lugar nenhum e descobrimos testando: cada cobertura
acessória é recusada acima de **30% do limite de incêndio**, com a mensagem
`"IS da Cobertura: <nome> fora do limite"`. Medido em dois limites
diferentes, quebrando no mesmo ponto:

```
LMI incêndio 144.000 · perda 43.200 (30%) → 201
LMI incêndio 144.000 · perda 50.400 (35%) → 400 fora do limite
LMI incêndio  60.000 · perda 18.000 (30%) → 201
LMI incêndio  60.000 · perda 21.000 (35%) → 400 fora do limite
```

Em imóvel comercial o teto é menor — em 17/08 o vendaval a 30% foi recusado
e a 25% passou. **Qual é a regra escrita?**

### 4.9 Itens menores

- **"Seguro sem Administração"** — checkbox no painel, sem campo conhecido na API.
- **"Sugestão de cláusula de seguro incêndio para o contrato de locação"** —
  texto que o painel oferece e que gostaríamos de reproduzir igual.

---

## 5. O que pedimos, em ordem

1. **Como pedir a tabela no `/calculo`** — ou a confirmação de que a API
   coteja só na padrão, e qual é ela.
2. **Por que a taxa por cobertura diverge** da tabela do painel (item 2).
3. **A fórmula do "Sugerir valores"**, ou um endpoint para ela.
4. **As duas ocupações residenciais** que faltam no `ocupacoes/R`.
5. **Qual pacote é o "Plano 1 · R$ 9,12"** da assistência.
6. **A regra escrita do teto** das coberturas acessórias.
7. **`listaFormasPagto` vazia** é definitivo?

Do item 1 ao 3 mexem em **preço**, e é onde a diferença que vocês vão ver nas
nossas cotações nasce. Os demais são completude.

---

## 6. Duas perguntas que continuam de antes

**O header `seguradora` parou de rotear.** O mesmo payload com `Alfa` e com
`Porto` devolve prêmio idêntico, centavo por centavo — medido em homologação
em 30/08 e em produção em 08/09. Como pedimos a cotação de uma seguradora
específica agora?

**As URLs de webhook, entregues em 18/08, não estão cadastradas.** Nenhum
webhook chegou desde 13/08. Sem elas o link da biometria nunca chega e a
fiança não passa de pré-aprovado.

---

*Todos os números deste documento estão em `diario-de-homologacao.md`, com
data, payload e resposta.*
