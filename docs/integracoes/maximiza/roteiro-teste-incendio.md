# Roteiro de teste — seguro incêndio

*Aberto em 30/08/2026 · reescrito em 08/09/2026, em duas fases*

O que precisa estar exercitado antes da primeira apólice real. Marque
conforme for passando; o que falhar vira entrada no `diario-de-homologacao.md`.

---

## Por que duas fases

Medido em 08/09 (ver o diário): **cada CNPJ só cota no seu ambiente.**

```
                        produção (1)   homologação (2)
IMOBILIATTO 4552…0106       201             400
CNPJ teste  1096…0180       400             201
```

Não dá pra ter os dois no mesmo lugar, e cada metade do roteiro precisa de um:

- **Fase 1 · cálculo, em produção.** É o único ambiente onde o nosso CNPJ
  coteja. Cálculo é consulta de preço — não emite apólice, não gera cobrança.
- **Fase 2 · contratar, documentos e cancelar, em homologação.** Emitir de
  verdade só depois do acerto comercial, então esta metade roda sob o CNPJ de
  teste, onde a apólice é de mentira.

A regra que separa as duas: **na Fase 1 não se clica em "Contratar".**

---

## O que já está provado, e é menos do que parece

Levantado da tabela `seguro_incendio_apolices` em 30/08. Sobraram **três
cotações**, todas de 17/08:

| Seguradora | Tipo | Vigência | Cobertura | Como terminou |
|---|---|---|---|---|
| Alfa | Residencial | Anual | 3 (só prédio) | ✅ contratada (607773) e cancelada |
| Alfa | Residencial | Mensal | 3 | ❌ erro "ambiente inválido" (antes do conserto) |
| Alfa | Comercial | Anual | 2 | ❌ erro "data_inquilino não informado" (antes do conserto) |

Ou seja: **uma única combinação foi ponta a ponta.** Alfa, residencial, anual,
cobertura 3. Tudo o mais está por exercitar.

E `seguro_comissoes` está **vazio** — a apólice 607773 foi contratada antes da
v81, então `registrarComissao()` nunca rodou de verdade nenhuma vez.

---

# FASE 1 — cálculo, em produção

## 1.0 · Virar o ambiente

Na Vercel, projeto → **Settings → Environment Variables**:

- [ ] `MAXIMIZA_AMBIENTE` de `2` para **`1`**, escopo **Production**
- [ ] **Redeploy.** Mudar a variável não afeta o deploy que já está no ar:
      Deployments → o último → ⋯ → Redeploy
- [ ] `MAXIMIZA_FORCAR_CNPJ_TESTE` **fica como está** — em ambiente 1 ele é
      ignorado no código (`cnpjDeTeste()` devolve null fora da homologação)

**Confirmação obrigatória antes de seguir:** abra `/painel/seguros/incendio`.
A faixa do topo tem que estar **vermelha**, dizendo "Produção". Se ainda
estiver cinza, o redeploy não pegou — **pare aqui**, porque cinza em produção
significa que a tela está mentindo sobre o que o botão faz.

- [ ] Faixa vermelha na tela

> **Enquanto a Fase 1 durar, o site publicado está em produção para todo
> mundo.** Qualquer pessoa com acesso ao painel que marque a caixa vermelha e
> clique em contratar emite apólice real. Faça a fase inteira de uma sentada e
> volte o ambiente no fim.

## 1.1 · A matriz de cálculo

Cada linha existe porque exercita um caminho diferente do código.

- [ ] **1.1 · Alfa · Residencial · Anual · cobertura 3**
      A combinação que já funcionou. Agora sob o CNPJ real e em produção —
      é o retorno mais importante da fase.

- [ ] **1.2 · Alfa · Residencial · Mensal**
      Nunca calculou com sucesso. A vigência troca o catálogo de assistência
      inteiro — códigos 1 a 5 no mensalizado, 8 a 12 no anual. Código de uma
      é inválido na outra.

- [ ] **1.3 · Porto · Residencial · Anual**
      Não sobrou nenhuma cotação Porto na base. A Porto exige endereço
      completo já no cálculo (a Alfa se contenta com CEP e UF) e usa outro
      catálogo de ocupação — `1/6` para apartamento, contra `4070/1002` da
      Alfa.

- [ ] **1.4 · Porto · Residencial · cobertura 3 (só prédio)**
      A Porto exige `vl_cob_conteudo` maior que zero mesmo quando o seguro
      não cobre conteúdo, e trata zero como campo não informado. O
      formulário barra antes com mensagem própria — confirme que ela
      aparece em vez do 400 cru.

- [ ] **1.5 · Alfa · Comercial · PJ no inquilino**
      A única tentativa comercial morreu em `data_inquilino não informado`.
      Com CNPJ no inquilino o rótulo do campo vira "Abertura da empresa".
      Confirme que vira, e que a cotação passa.

- [ ] **1.6 · Nome com uma palavra só**
      A Alfa devolve `"Nome Segurado Inválido<br/>Nome Beneficiário
      Inválido<br/>"`, que não diz o que corrigir. O formulário deve barrar
      antes, dizendo.

### O que olhar em toda cotação que calcular

- [ ] A **taxa** aparece ao lado do prêmio de cada cobertura
- [ ] O **% do prêmio sobre o aluguel** aparece embaixo do total
- [ ] Se for Alfa: o parcelamento aparece mesmo com a API mandando
      `listaFormasPagto` vazia, e a tela diz que foi calculado
- [ ] O campo **Controle** salva, aparece no cabeçalho da cotação e acha a
      cotação na busca da listagem

### Duas checagens só desta fase

- [ ] **Puxar um contrato do CRM e conferir a vigência.** O fim tem que vir
      12 meses depois do início, e não a data de término do contrato de
      locação. Consertado em 08/09 (`form-incendio.tsx:169`); em produção um
      erro aqui vira recusa da seguradora
- [ ] **O CNPJ que saiu na cotação.** No `seguro_eventos`, o `request` do
      `/calculo` tem que trazer `cpfcnpj_imob: 45528182000106`. Se vier
      `10961528000180`, o ambiente não virou

### E uma pergunta que só a produção responde

- [ ] **O preço bate com o do painel da corretora?** Homologação nunca
      permitiu conferir isso. Cote a mesma coisa nos dois e compare o prêmio.
      Se divergir, é o campo "Tabela" (1 a 20) do painel deles, que não
      existe na API — está no item 3.1 de `incendio-para-ligar.md`

---

# FASE 2 — contratar, documentos e cancelar, em homologação

## 2.0 · Voltar o ambiente

- [ ] `MAXIMIZA_AMBIENTE` de volta para **`2`** na Vercel
- [ ] **Redeploy** de novo
- [ ] A faixa voltou a ser **cinza**, dizendo "Homologação" e que está cotando
      forçado no CNPJ de teste

Não volte para contratar uma cotação criada na Fase 1: ela nasceu em produção,
e contratá-la agora manda um corpo de homologação em cima de dados de outro
ambiente. **Faça cotações novas para os blocos abaixo.**

## 2.1 · Contratar uma na Porto

Só uma, e na Porto, porque a Alfa já foi. Fecha o par de seguradoras.

- [ ] **2.1** A apólice sai com `codigo_seguro` e `numero_proposta`
- [ ] **2.2** `seguro_comissoes` ganha uma linha — **esta é a checagem
      principal do bloco.** O caminho nunca rodou; se falhar, falha calado,
      porque `registrarComissao` não derruba a contratação de propósito
- [ ] **2.3** Se a cotação estiver vinculada a um contrato de locação, o
      `valor_seguro_incendio_anual` e o `seguro_incendio_data` do contrato
      são preenchidos

## 2.2 · Documentos

- [ ] **3.1** Certificado e proposta baixam
- [ ] **3.2** O boleto **falha**, com *"Fatura não encontrada"* — e isso é o
      **curso normal**: a fatura só existe depois do fechamento do lote da
      seguradora. Tem que aparecer em âmbar, como aviso, não em vermelho
      como erro, e o certificado já baixado não pode sumir junto

## 2.3 · Cancelar

- [ ] **4.1** Devolve *"Certificado cancelado com sucesso."*
- [ ] **4.2** A mensagem de erro da ação anterior sumiu da tela antes desta

---

## O que NÃO dá pra testar em nenhuma das duas fases

- **Boleto de verdade** — depende do fechamento do lote deles
- **`listarFaturamento`** — nunca exercitado, e sem apólice faturada não tem
  o que listar
- **A escolha de seguradora** — o header `seguradora` parou de rotear, e em
  08/09 foi medido que em produção também não roteia: Alfa e Porto devolvem
  prêmio idêntico. As linhas 1.3 e 1.4 da matriz exercitam o **formulário** da
  Porto (endereço obrigatório, catálogo de ocupação, `vl_cob_conteudo`), não a
  seguradora que vai atender. Item 1.4 de `incendio-para-ligar.md`

---

## Passar tudo isso NÃO é sinal verde pra produção

O teste prova que o código funciona. Falta o que não depende de código:

- [x] **Credencial de produção** — é a mesma do login; o que muda é o campo
      `ambiente` do corpo. Confirmado em 08/09
- [ ] **Pró-labore confirmado** — exibimos 20% como estimativa, lida do
      painel deles; ninguém confirmou se é fixo, por seguradora ou negociado
- [ ] **Regra de estorno no cancelamento** — proporcional? do prêmio e da
      comissão?
- [ ] **Contrato de parceria e tabela de comissionamento**

Só quando esses três fecharem é que `MAXIMIZA_AMBIENTE` fica em `1` — e a
partir daí toda contratação é dinheiro real de cliente real.
