# Roteiro de teste — seguro incêndio

*Homologação · aberto em 30/08/2026*

O que precisa estar exercitado antes de pedir credencial de produção. Marque
conforme for passando; o que falhar vira entrada no `diario-de-homologacao.md`.

---

## O que já está provado, e é menos do que parece

Levantado da tabela `seguro_incendio_apolices` em 30/08. Sobraram **três
cotações**, todas de 17/08 (linhas podem ter sido apagadas pelo botão de
excluir, então isto é piso, não retrato completo):

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

## Antes de começar

- [ ] A faixa no topo de `/painel/seguros/incendio` está **cinza**, dizendo
      "Homologação". Se estiver **vermelha**, pare: a `MAXIMIZA_AMBIENTE` da
      Vercel está em 1 e o botão de contratar emite de verdade.
- [ ] A faixa diz que a cotação sai sob o seu CNPJ. Depois da primeira
      cotação dá pra confirmar no `seguro_eventos`: o `request` do
      `/calculo` traz `cpfcnpj_imob`, que deve ser `45528182000106` e não
      `10961528000180`.

---

## Bloco 1 — cálculo: a matriz que falta

Cada linha existe porque exercita um caminho diferente do código, não por
capricho.

- [ ] **1.1 · Alfa · Residencial · Anual · cobertura 3**
      Refazer o que já funcionou, só pra confirmar que a troca de CNPJ não
      quebrou nada.

- [ ] **1.2 · Alfa · Residencial · Mensal**
      Nunca calculou com sucesso. A vigência muda o catálogo de assistência
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

---

## Bloco 2 — contratar uma na Porto

Só uma, e na Porto, porque a Alfa já foi. Fecha o par de seguradoras.

- [ ] **2.1** A apólice sai com `codigo_seguro` e `numero_proposta`
- [ ] **2.2** `seguro_comissoes` ganha uma linha — **esta é a checagem
      principal do bloco.** O caminho nunca rodou; se falhar, falha calado,
      porque `registrarComissao` não derruba a contratação de propósito
- [ ] **2.3** Se a cotação estiver vinculada a um contrato de locação, o
      `valor_seguro_incendio_anual` e o `seguro_incendio_data` do contrato
      são preenchidos

---

## Bloco 3 — documentos

- [ ] **3.1** Certificado e proposta baixam
- [ ] **3.2** O boleto **falha**, com *"Fatura não encontrada"* — e isso é o
      **curso normal**: a fatura só existe depois do fechamento do lote da
      seguradora. Tem que aparecer em âmbar, como aviso, não em vermelho
      como erro, e o certificado já baixado não pode sumir junto

---

## Bloco 4 — cancelar

- [ ] **4.1** Devolve *"Certificado cancelado com sucesso."*
- [ ] **4.2** A mensagem de erro da ação anterior sumiu da tela antes desta

---

## O que NÃO dá pra testar aqui, e não adianta tentar

- **Boleto de verdade** — depende do fechamento do lote deles
- **`listarFaturamento`** — nunca exercitado, e sem apólice faturada não tem
  o que listar
- **Se o preço de homologação é o preço real** — não há como saber daqui
- **O campo "Tabela" (1 a 20)** do painel deles, que não existe na API.
  Cotamos sempre no padrão sem saber se ele mexe em preço ou comissão

---

## Passar tudo isso NÃO é sinal verde pra produção

O teste prova que o código funciona. Falta o que não depende de código:

- [ ] **Credencial de produção** — a atual é de homologação
- [ ] **Pró-labore confirmado** — exibimos 20% como estimativa, lida do
      painel deles; ninguém confirmou se é fixo, por seguradora ou negociado
- [ ] **Regra de estorno no cancelamento** — proporcional? do prêmio e da
      comissão?
- [ ] **Contrato de parceria e tabela de comissionamento**

Só quando esses quatro fecharem é que `MAXIMIZA_AMBIENTE` vira `1` — e a
partir daí toda contratação é dinheiro real de cliente real.
