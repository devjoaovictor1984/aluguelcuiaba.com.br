# Anatomia de uma cotação de incêndio

*Medido contra a API viva em 30/08/2026. Serve para ler um erro sem adivinhar
de que lado ele nasceu.*

---

## As quatro chamadas de uma cotação

Abrir o formulário e clicar em calcular dispara quatro requisições, nesta
ordem. Só a última é a cotação de fato; as três primeiras enchem os campos.

| # | Endpoint | Método | O que faz |
|---|---|---|---|
| 1 | `/auth` (host `auth.api.seguro.imb.br`) | POST | Troca e-mail e senha por um JWT de 30 min |
| 2 | `/incendioAlfaV2/listarSeguradorasDisponiveis` | GET | Popula os botões de seguradora |
| 3 | `/incendioAlfaV2/ocupacoes/{R\|C}` | GET | Popula "Ocupação do imóvel" |
| 3 | `/incendioAlfaV2/listaPacotesAssist24hs` | POST | Popula "Assistência 24h" |
| 4 | `/incendioAlfaV2/calculo` | POST | **A cotação.** Devolve prêmio e coberturas |

O token vai no header `Authorization` **sem o prefixo `Bearer`** — a API
rejeita o formato padrão.

---

## O que MANDAMOS no `/calculo`

Este é o corpo real de uma cotação que funciona. Cada campo está marcado com
de onde ele sai.

```jsonc
{
  // ── Contexto: nós resolvemos, o corretor não vê ──
  "ambiente": "2",                       // 2 = homologação. TEXTO no incêndio
                                         // (na fiança é número — sim, difere)
  "cpfcnpj_imob": "10961528000180",      // ← A CHAVE DE TUDO. Ver seção do erro

  // ── Escolhas do formulário ──
  "tipo_seguro": "R",                    // R residencial · C comercial
  "tipo_vigencia": 0,                    // 0 anual · 1 mensalizado
  "tipo_cobertura": 2,                   // 2,3,4,5 — tabela deles
  "aluguel": 1800,
  "rubricao_cupacao": "4070",            // ← veio da chamada 3 (ocupações)
  "cdresp2_cupacao": "1002",             // ← idem, anda junto com a rubrica
  "cdpacote_assist": 8,                  // ← veio da chamada 3 (assistência)

  // ── Inquilino ──
  "nome_inquilino": "ANDRESSA SIMAO DA SILVA",   // precisa de nome E sobrenome
  "cpf_inquilino": "138.707.247-14",
  "tipo_inquilino": "F",                 // F pessoa física · J jurídica
  "data_inquilino": "25/05/1993",        // obrigatória — inclusive para PJ
  "ddd_inquilino": 21,
  "fone_inquilino": "97993-1028",
  "email_inquilino": "andressassimao@hotmail.com",

  // ── Proprietário ──
  "nome_proprietario": "RIVANIA SILVA PASSOS COUTINHO",
  "cpf_proprietario": "361.799.901-82",
  "tipo_proprietario": "F",

  // ── Imóvel ──
  "endereco_seguro": "R. A, 11 - Res. Paiaguás, Cuiabá - MT",
  "bairro_endereco_seguro": "Paiaguás",
  "cidade_endereco_seguro": "Cuiabá",
  "uf_endereco_seguro": "MT",
  "cep_endereco_seguro": "78048-258",

  // ── Vigência (formato BR, dd/mm/aaaa) ──
  "inicio_vigencia_seguro": "30/08/2026",
  "fim_vigencia_seguro": "30/08/2027",

  // ── Valores segurados: quanto cada cobertura protege ──
  // Estes são NOSSOS chutes iniciais (ver "quem inventa o quê" abaixo).
  "vl_cob_incendio": 144000,             // aluguel × 80
  "vl_cob_conteudo": 28800,              // 20% do prédio, no tipo 2
  "vl_cob_vendaval": 36000,              // 25% do prédio
  "vl_cob_perda_aluguel": 10800,         // 6 aluguéis
  "vl_cob_danos_eletrico": 7200,         // 5%
  "vl_cob_vazamento": 7200,              // 5%
  "vl_cob_resp_civil": 14400             // 10%
}
```

---

## O que ELES DEVOLVEM

```jsonc
{
  "coberturas": [
    { "cdcob": "14010",
      "nmcobert": "Incêndio, Raio. Explosão, Queda de Aeron",
      "lmi": "144000.00",                // ← o valor que MANDAMOS, ecoado
      "premio": "98.86",                 // ← o preço DAQUELA cobertura
      "txtfranq": "10% prejuízos c/ mínimo R$ 500,00 (Raio)" },
    { "cdcob": "10235", "nmcobert": "Perda ou Pagamento de Aluguel",
      "lmi": "10800.00", "premio": "11.81",  "txtfranq": "-" },
    { "cdcob": "14073", "nmcobert": "Vendaval...Furacão, Ciclone, Tornado,...",
      "lmi": "36000.00", "premio": "95.63",  "txtfranq": "10% prejuízos…" },
    { "cdcob": "14227", "nmcobert": "Responsabilidade Civil Familiar",
      "lmi": "14400.00", "premio": "6.55",   "txtfranq": "-" },
    { "cdcob": "14020", "nmcobert": "Danos Elétricos",
      "lmi": "7200.00",  "premio": "121.54", "txtfranq": "10% prejuízos…" },
    { "cdcob": "14151", "nmcobert": "Vazamento Acid. Rede Part.Água/Esgoto",
      "lmi": "7200.00",  "premio": "5.25",   "txtfranq": "10% prejuízos…" }
  ],
  "listaFormasPagto": [],   // ← VEM VAZIA sempre. Derivamos o parcelamento
  "cdsequencia": "0",
  "mensagem": "OK",
  "premio":    "364.71",    // total que o cliente paga
  "vlpreliq":  "339.64",    // prêmio líquido
  "vliof":     "25.07",     // imposto
  "vlassist":  "0.00"       // assistência 24h (0 = pacote "sem assistência")
}
```

Repare: **tudo volta como string**, inclusive números. E o `premio` de cada
cobertura é o preço dela — a soma delas é o `vlpreliq`, e `vlpreliq + vliof +
vlassist = premio`.

---

## Quem inventa o quê

Esta é a confusão mais comum ao olhar a tela.

| | De onde vem |
|---|---|
| **Tipo de cobertura** (2, 3, 4, 5) e o que cada um significa | **Deles.** Tabela documentada. O "90%/10%" do tipo 4 é definição deles |
| **Os campos** `vl_cob_*` | **Deles.** São os campos da API |
| **Os valores** que preenchem esses campos | **Nossos.** `sugerirValores()` chuta a partir do aluguel: prédio = aluguel × 80, perda de aluguel = 6 meses, vendaval 25%, elétricos 5%, vazamento 5%, resp. civil 10%. Convenção de mercado, não regra da seguradora — o corretor edita à vontade |
| **O prêmio** de cada cobertura | **Deles.** Sai do cálculo, não temos como prever |
| **O parcelamento** | **Nosso, por necessidade.** `listaFormasPagto` vem vazia; derivamos do prêmio com parcela mínima de R$ 60 |
| **Pró-labore de 20%** | **Estimativa nossa**, lida da coluna do painel deles. A API não devolve |

---

## O erro que está travando agora

```
400  Erro em EnviaCertificadoXML. Contacte o Administrador.
     Erro: Usuário e/ou Senha Inválidos! Tente novamente ou contate Sistemas.
```

**Não é o nosso login.** Se fosse, a chamada 1 (`/auth`) teria falhado e
nenhuma das outras sairia. O que acontece é: autenticamos normal, o request
chega na regra de negócio deles, e **o sistema deles** tenta falar com a
seguradora usando as credenciais amarradas ao `cpfcnpj_imob` que mandamos —
e essas credenciais é que estão inválidas.

Provado trocando **só** esse campo, com todo o resto idêntico:

```
cpfcnpj_imob = 45528182000106  (IMOBILIATTO)   → 400  "Usuário e/ou Senha Inválidos!"
cpfcnpj_imob = 10961528000180  (teste)         → 201  prêmio 364,71
```

Vale para Alfa e para Porto. **Não há nada a fazer no formulário** — nenhum
campo, valor ou seguradora muda esse resultado. É provisionamento do lado da
corretora.

### Como ler qualquer erro deles, daqui pra frente

| A mensagem | Onde nasceu | Quem conserta |
|---|---|---|
| `<campo> não informado` | Validação de entrada deles | Você, no formulário |
| `Nome Segurado Inválido` | Validação da seguradora | Você (nome e sobrenome) |
| `IS da Cobertura … fora do limite` | Regra de limite da seguradora | Você, baixando o valor segurado |
| `Usuário e/ou Senha Inválidos` | Credencial deles com a seguradora | **Eles** |
| `Erro em EnviaCertificadoXML` | Integração deles com a seguradora | **Eles** |
| `504 Gateway Time-out` | Infra deles | **Eles** (já aconteceu em 17/08, voltou sozinho) |

---

## Três coisas mudaram na API deles entre 17/08 e 30/08

Nenhuma anunciada, nenhuma com versão nova de endpoint.

**1. `listarSeguradorasDisponiveis` trocou o formato da resposta**

```
16/08:  ["Alfa","Porto"]
30/08:  [{"seguradora":"Alfa","sigla":"al2"},{"seguradora":"Porto","sigla":"por"}]
```

**2. `ocupacoes/R` parou de honrar o header `seguradora`.** Seis valores
diferentes — incluindo um inválido e nenhum header — devolvem a lista da Alfa.
Em 17/08 a Porto devolvia `1/6 (APARTAMENTOS)`.

**3. `/calculo` também parou.** Payload idêntico:

```
header seguradora = Alfa   → premio 364.71 · 6 coberturas
header seguradora = Porto  → premio 364.71 · 6 coberturas
header seguradora = al2    → premio 364.71 · 6 coberturas
header seguradora = por    → premio 364.71 · 6 coberturas
SEM header                 → premio 364.71 · 6 coberturas
```

E não achamos roteamento novo no corpo: `seguradora`, `sigla`, `cdseguradora`
e `cia` foram testados, todos com o mesmo resultado.

**Consequência prática:** o seletor de seguradora da nossa tela está
decorativo. Escolher Porto grava `seguradora: "Porto"` numa cotação que a API
calculou como se fosse outra. Não dá pra corrigir daqui — só sabendo qual é o
mecanismo novo.

As três mudanças aparecerem juntas, e junto com o erro de credencial, sugere
um deploy na API de incêndio deles por volta de 28/08 — mesma data em que
habilitaram a IMOBILIATTO. É hipótese, não medição.
