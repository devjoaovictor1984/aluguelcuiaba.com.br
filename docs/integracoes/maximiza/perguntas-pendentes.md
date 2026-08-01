# Integração AluguelCuiabá × Maximiza — pontos em aberto

**Situação:** a integração de **seguro fiança** está construída e funcionando de
ponta a ponta no nosso ambiente — provisionamento da imobiliária, transmissão da
análise, leitura dos pareceres das quatro seguradoras, biometria, documentos e os
três webhooks. Falta ligar na API de vocês.

Os pontos abaixo estão agrupados por urgência. Os do bloco 1 estão **parando
trabalho hoje**.

---

## 1. Bloqueiam o início dos testes

**1.1 Credencial de homologação**
Precisamos do e-mail e senha de teste para `POST https://auth.api.seguro.imb.br/auth`.
Quando podemos ter?

**1.2 Autenticação dos webhooks**
A documentação lista apenas `Content-Type: application/json` nos webhooks de
análise, biometria e arquivos — sem assinatura, HMAC ou token.

Do nosso lado tratamos isso não confiando no corpo da requisição: usamos o
webhook apenas como aviso de mudança e reconsultamos o estado com nosso token.
Ainda assim, gostaríamos de fechar mais:

- Vocês aceitam que a URL cadastrada contenha um segredo no caminho?
  Ex.: `https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/<segredo>/analise`
- Qual a faixa de IPs de origem dos webhooks, para restringirmos?
- Qual a política de retentativa? Quantas vezes e em que intervalo?

**1.3 Sigla da Porto Seguro**
Há divergência na documentação:

| Onde | Valor |
|---|---|
| Retorno de `/seguradorasAnalise` | `porto` |
| Exemplo de `transmitirAnalise` (PDF, pág. 3) | `por` |
| Campo `sigla` no retorno da análise (pág. 9) | `por` |

**Qual valor devemos enviar em `seguradorasAnalise`?**

**1.4 Ambiente**
Confirmamos o entendimento: produção e homologação usam a **mesma URL**, e o que
separa as duas é o campo `ambiente` no corpo (1 = produção, 2 = homologação).
Está correto?

---

## 2. Bloqueiam o modelo comercial

**2.1 Atribuição da comissão** ⚠️ *o ponto mais importante*
Quando cadastramos uma imobiliária pela nossa integração
(`/apiImobiliaria/cadastrarImobiliaria`), ela fica vinculada à nossa parceria?

Concretamente: **se um corretor cadastrado por nós origina uma apólice, quem
recebe a comissão** — a imobiliária cadastrada, ou a plataforma que originou?

**2.2 O campo `corretora`**
No webhook de análise aparece `dadosAnalise.corretora: "99"`. O que representa
essa entidade? Nós temos ou teremos um código desses?

**2.3 `cod_alfa` e `cod_porto`**
O retorno de `/apiImobiliaria/consultarImobiliaria` traz esses dois campos, que
não constam na documentação. Para que servem e quem os define?

**2.4 Janela de atribuição**
Se o corretor inicia a cotação pela nossa plataforma e conclui por outro canal
(WhatsApp com o gerente de vocês, por exemplo), a originação continua sendo
nossa? Por quanto tempo?

**2.5 Remuneração**
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

**3.4 Contradição na descrição dos status**
As páginas 9 e 10 do PDF dizem "Aprovado(1), Reprovado(2), Em Análise(3)", mas a
tabela oficial da página 23 (e o OpenAPI) dizem `2 = Em Análise` e
`3 = Recusado`. Estamos seguindo a tabela e lendo sempre o `codigoStatus`, nunca
o `descricaoStatus`. Confirmam?

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

Recebemos a documentação de fiança e da API de imobiliária. **Falta a
especificação do seguro incêndio.**

Nossa estrutura já está preparada para recebê-lo. Quando podemos ter?

---

## 8. Para entrar em produção

Checklist do que precisamos de vocês para ligar:

- [ ] Credencial de **produção** (separada da de homologação)
- [ ] URLs de webhook cadastradas do lado de vocês (análise, biometria, arquivos)
- [ ] Contrato de parceria assinado
- [ ] Tabela de comissionamento definida
- [ ] DPA / acordo de tratamento de dados
- [ ] Autorização de uso de marca
- [ ] Contato técnico e contato comercial nomeados

---

*Documento gerado a partir da análise de `api.fianca.pdf` (v1, 24 páginas),
`api.imobiliaria.pdf` (v1) e da especificação OpenAPI 3.0 fornecida.*
