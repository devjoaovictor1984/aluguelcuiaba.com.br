# Estratégia de Parcerias — USO INTERNO / CONFIDENCIAL

> ⚠️ **Este documento NÃO deve ser mostrado à Maximiza nem a parceiros.**
> É a sua "cola" de negociação. O material externo é o `aluguelcuiaba-deck.html` e o `dossie-tecnico.md`.

---

## Princípio número 1: separar parceria comercial de sociedade

São duas conversas com riscos totalmente diferentes. Não as misture na mesma mesa.

- **Parceria comercial** (integração de seguro, canal, co-marketing): baixo risco, reversível, começa rápido. **Faça agora.**
- **Sociedade / equity** (vender % do negócio): alto risco, irreversível. **Só depois de validar, com números na mão.**

**Regra de ouro:** não venda equity antes de ter tração. Você daria metade do upside e do controle por uma validação que ainda não existe. Depois do piloto, o mesmo % vale muito mais.

---

## Avaliação dos modelos que você levantou

### Modelo A — divisão de responsabilidades (você: sistema+marketing / eles: captação+comercial)
- **Bom como descrição de papéis**, não como contrato em si. É o "como trabalhamos", não o "como dividimos o dinheiro".
- Use isso para enquadrar a conversa, mas o que fecha negócio é a parte financeira (comissão/split), não só a divisão de tarefas.

### Modelo B — integração de seguros (API acoplada ou link) + eles trazem clientes + co-marketing
- **É o que eu recomendo começar.** Baixo atrito, todo mundo ganha rápido.
- **Link redirecionando** = MVP: zero integração técnica, começa quase imediatamente. Você manda o lead pro painel deles.
  - Risco: você perde dados da jornada e fica mais difícil auditar comissão. → **resolva no contrato**: comissão por lead/apólice originada pela plataforma, com relatório mensal das duas partes.
- **API acoplada** = cotação/contratação dentro do seu sistema. Melhor experiência, dados seus, comissão rastreável. Exige a Maximiza ter API e mais negociação técnica.
- **Caminho:** começa no link, evolui pra API quando o volume justificar. **Garanta a comissão no contrato desde o dia 1, independente do meio.**

### Modelo C — Maximiza compra 50% + 50/50 nas franquias + % do franqueado
- **Não faça isso agora.** Três problemas:
  1. **Cedo demais:** vender 50% pré-validação = valuation baixíssimo. Você está dando o ativo principal (o sistema) barato.
  2. **50/50 trava:** sociedade meio a meio gera impasse — ninguém tem a palavra final. Se um dia divergirem, o negócio paralisa. Se for sociedade, tenha majoritário ou cláusula de desempate.
  3. **Mistura camadas:** o seguro (negócio deles) e a franquia (negócio do sistema) são receitas diferentes. Dar 50% de TUDO por um aporte comercial desequilibra — o moat é o seu código + marca.
- **Quando reconsiderar:** depois do piloto, se eles quiserem acelerar com capital e canal, aí sim — com valuation real e estrutura societária protegida.

---

## O ativo mais valioso que a Maximiza traz: o CANAL

Eles já têm clientes (imobiliárias) fazendo seguro em **várias cidades**. Isso resolve o maior gargalo de qualquer SaaS: **aquisição de clientes**. Cada cliente deles é um assinante/franqueado em potencial.

→ Por isso a parceria de canal vale tanto, mesmo sem equity. Trate o acesso à carteira deles como a contrapartida principal da negociação.

---

## Estrutura de franquia (sua, separada da Maximiza)

O franqueado paga:
1. **Taxa de entrada** (franchising) — adesão única.
2. **Mensalidade / royalty** — uso do sistema + marca (recorrente; é o que sustenta a operação).
3. **(Opcional) % sobre captação** — um percentual do que ele faturar com os imóveis captados nos planos.

A divisão desses ganhos **com a Maximiza só existe se ela for sócia (Modelo C) ou o canal que vende as franquias** (aí ela ganha comissão sobre as que originar). Como parceira comercial pura, ela **não** entra em 50% das franquias.

---

## O que blindar no contrato

- **Relação direta com o cliente:** quem assina o sistema é cliente SEU. Se a Maximiza sair, a base fica. (Evita dependência total de canal.)
- **Comissão de seguro:** definição clara de "apólice originada pela plataforma", forma de medição e relatório das duas partes.
- **Exclusividade:** se pedirem exclusividade de seguros no sistema, troque por contrapartida (volume mínimo, co-investimento em marketing, ou prazo curto renovável). Não trave indefinido com um só parceiro.
- **Propriedade do código e da marca:** 100% sua. Não entra em nenhum acordo comercial.
- **Dados:** isolamento por cidade/tenant (RLS) + LGPD — crítico porque pode haver concorrência entre franqueados/clientes.

---

## Roteiro de negociação sugerido

1. **Abra pela parceria comercial** (Modelo B): "vamos integrar o seguro e trazer sua carteira pro sistema, com comissão por apólice e co-marketing."
2. **Proponha o piloto em Cuiabá** com meta clara (X apólices / Y imobiliárias em N meses).
3. **Deixe a sociedade para depois:** "equity faz sentido quando provarmos o modelo juntos — e aí com números."
4. Se insistirem em equity agora, **ancore alto** e condicione a metas — nunca 50/50 sem proteção.

---

## Resumo de uma linha
**Comece com parceria comercial (seguro + canal + co-marketing). Guarde equity para a Fase 2, depois de validar, e nunca em 50/50 sem desempate. O código e a marca são seus — esse é o seu poder de barganha.**
