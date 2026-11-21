# Integração com portais — OLX · ZAP Imóveis · Viva Real

Início: 21/11/2026 (migration **v107**).

## Como funciona (um feed só para os três)

OLX, ZAP Imóveis e Viva Real são todos do **Grupo OLX** (a OLX comprou o
Grupo ZAP em 2020). O anunciante profissional publica nos três pelo
**Canal Pro**, com plano "multiportal". A integração não é por API de
gravação: o anunciante cadastra no Canal Pro **uma URL de feed XML** no
padrão **VRSync**, e o portal lê essa URL de tempos em tempos e publica o que
estiver nela.

Então o que o sistema faz é **servir esse XML**:

```
Painel → Portais → liga o anúncio  ─┐
                                    ├─► GET /api/portais/vrsync/<token>  ◄── Canal Pro lê
Anúncio ativo, dentro da validade ──┘        (XML VRSync)                    e publica no
                                                                             OLX · ZAP · VR
```

Saiu do feed (pausou, alugou, venceu, desligou), o portal despublica na
próxima leitura.

Especificação: <https://developers.grupozap.com/feeds/vrsync/>

**Mão única:** o feed vai do site para o portal. Anúncios que o anunciante
já tem cadastrados à mão no Canal Pro **não** são puxados para cá (não há API
pública de leitura). Regras do portal para quem já anuncia lá
(`feeds/integration_rules.html`):

- O feed **não apaga** anúncio manual; apagar é manual, no Canal Pro.
- Se o anúncio do feed bate com um manual, o do feed é **recusado como
  duplicado** até o manual ser apagado.
- Anúncio que veio pelo feed **não pode ser editado à mão** no Canal Pro.
- O que passar da grade do plano contratado é desativado automaticamente.

Para migrar: cadastrar aqui, apagar o manual, ligar no feed (um por vez, se
não quiser o imóvel fora do ar por até 12 h). Se o anunciante usa outro
sistema que já gera um feed VRSync, dá para importar desse XML (não feito,
ver Pendente).

A tela *Portais* tem o bloco **"Como funciona"** (`_components/como-funciona.tsx`)
com esta explicação em passo a passo, aberto enquanto a URL não foi gerada.
Mudou a regra aqui, muda o texto lá.

## Deixar pronto sem ter plano no Canal Pro

O dono do site não tem plano; os clientes podem ter. Então tudo fica pronto
para quem contratar, e dá para testar antes:

1. **Portais → "Testar sem plano" → Baixar arquivo de teste**
   (`/painel/anuncios/portais/arquivo-teste`). É o mesmo XML que o portal leria.
   Sem nenhum anúncio ligado, leva todos os que passam nas regras (`?todos=1`);
   com ligados, só os ligados. Exige login; não grava leitura.
2. Subir o arquivo no validador oficial
   (<https://developers.grupozap.com/feeds/xml_validator/>, não pede conta).
   Erro lá → corrigir `src/lib/portais/vrsync.ts`.
3. Quem contratar: **"Mensagem para o Canal Pro"** já vem pronta com a URL,
   é só copiar e mandar ao gerente.
4. O admin acompanha em **/admin/portais**: quem gerou URL, quantos anúncios
   ligados e se o Canal Pro já está lendo (sem mostrar o token).

**"Última leitura" só conta robô.** A rota do feed só grava `lido_em` quando
o User-Agent não é de navegador comum; abrir a URL no navegador para conferir
não finge que o portal leu nem apaga a leitura dele. Se quem leu foi o
VivaRealBot, a tela mostra "Portal conectado".

## O que o anunciante precisa ter

1. **Conta no Canal Pro com plano contratado.** É comercial e pago, negociado
   com o Grupo OLX; o sistema não cria isso.
2. Pedir ao Canal Pro / gerente de contas a **integração por feed XML
   (VRSync)** e cadastrar a URL que o painel mostra em *Portais*.
3. O tipo de destaque (Padrão / Destaque / Super destaque) tem que caber no
   plano contratado — o portal recusa destaque que o contrato não cobre.

## No sistema

| Peça | Onde |
| --- | --- |
| Migration | `supabase/migrations/crm_v107_portais_feed.sql` |
| Gerador do XML (funções puras) | `src/lib/portais/vrsync.ts` |
| Consulta dos anúncios do feed | `src/lib/portais/consulta.ts` |
| Rota pública do feed | `src/app/api/portais/vrsync/[token]/route.ts` |
| Monta o XML de um anunciante (rota + teste) | `montarFeed()` em `src/lib/portais/consulta.ts` |
| Arquivo de teste (logado) | `src/app/(auth)/painel/anuncios/portais/arquivo-teste/route.ts` |
| Acompanhamento do admin | `src/app/admin/portais/page.tsx` |
| Tela | `src/app/(auth)/painel/anuncios/portais/` |
| Ações (ligar, destaque, gerar/trocar URL) | `src/app/(auth)/painel/anuncios/actions-crud.ts` |

**Dados novos (v107):**

- `imoveis.publicar_portais` (default `false`) e `imoveis.portais_destaque`.
- Tabela `portais_feed` (`user_id`, `token`, `lido_em`, `lido_por`), com RLS
  ligado e **sem política**: só o servidor lê. O token **não** fica em
  `perfis` porque `perfis` é lido pelo cliente anônimo (página pública do
  anunciante) e o RLS é por linha, não por coluna — o token vazaria.

**Segurança do feed:** o portal não faz login, então quem protege é o token
(43 caracteres aleatórios). Token errado e inexistente respondem 404 igual.
"Trocar URL" gera outro token e a URL antiga para na hora (depois é preciso
recadastrar no Canal Pro). Cada leitura grava `lido_em`/`lido_por`, e a tela
mostra "Última leitura" — é como saber se o portal já está puxando.

O feed tem cache de CDN de 15 min (`s-maxage=900`).

**Leitura pelo portal** (`feeds/connection_guideline.html`): a cada **12 h**,
User-Agent `VivaRealBot/1.0`, timeout de 60 s para conectar e 20 min para
baixar, até 50 mil anúncios por arquivo. Conferido em 21/11/2026 que a Vercel
não bloqueia esse User-Agent (token inexistente responde 404, não 403). A
doc também lista IPs do robô para liberar em firewall; aqui não há firewall
próprio, então não se aplica.

## Regras do VRSync que o gerador aplica

Um anúncio com problema **vermelho** não entra no feed (o portal recusaria);
**cinza** é aviso. A tela de Portais lista o que falta em cada anúncio.

| Regra do portal | Como fica aqui |
| --- | --- |
| Mínimo de **5 fotos**, só **JPG** | Fotos não-JPG ficam de fora; menos de 5 JPG bloqueia |
| Foto identificada pela URL; mudou a foto, a URL tem que mudar | O site regrava `1.jpg`, `2.jpg`… no mesmo caminho; o feed põe `?v=<updated_at>` |
| Título 10–100 caracteres | Bloqueia abaixo de 10; corta em 100 |
| Descrição 50–3000, texto | O HTML do editor vira texto; se ficar curta, completa com quartos/área/bairro |
| CEP obrigatório | Bloqueia sem `endereco_cep` ou sem 8 dígitos; vai como `78000-000` |
| Área (`LivingArea`) obrigatória | `area_m2`, senão `area_construida_m2`; terreno usa `area_terreno_m2` |
| Valores inteiros, BRL | Arredonda |
| IPTU | Vai como **mensal** (`period="Monthly"`), que é como o site cadastra |
| Endereço | `displayAddress="Neighborhood"`: o portal mostra só o bairro, como o site. Rua/número vão só para geolocalizar |
| Valor em pacote | Vai só o aluguel, sem condomínio/IPTU separados (aviso) |

Mapeamento de tipo: apartamento → `Residential / Apartment`; casa →
`Residential / Home` (ou `Residential / Condo` se tem condomínio); kitnet →
`Residential / Kitnet`; terreno → `Residential / Land Lot`; comercial →
`Commercial / Business`.

Garantias: fiança → `INSURANCE_GUARANTEE`, caução → `SECURITY_DEPOSIT`,
fiador → `GUARANTOR`. Características: piscina → `Pool`, pets →
`Pets Allowed`, mobiliado → `Furnished`.

## Como testar

1. Rodar a v107 no Supabase.
2. *Portais* → **Gerar URL do feed**, ligar um anúncio completo.
3. Abrir a URL no navegador: tem que vir o XML com um `<Listing>`.
4. Passar o XML no validador do portal: <https://developers.grupozap.com/feeds/xml_validator/>.

## Pendente / não confirmado

Doc pública relida em 21/11/2026 (header, listing, details, examples,
connection_guideline, integration_rules, xml_validator, webhooks de leads).

- **Ainda não lido por um Canal Pro de verdade.** O XML segue a doc e é bem
  formado. O XSD oficial (`xml.vivareal.com/vrsync.xsd`) responde 403, então
  não deu para validar contra o schema; o validador
  (`/feeds/xml_validator/`) é só formulário de upload, sem API. Próximo passo:
  subir um XML real nele (ou abrir no VS Code, que valida pelo
  `schemaLocation`), e depois o relatório de integração do Canal Pro.
- Pontos em que a doc se contradiz, resolvidos seguindo **os exemplos**:
  `ContactInfo` dentro de cada `Listing` (o texto diz "no mesmo nível");
  `Iptu` em vez de `YearlyTax` (este está em desuso, mas aparece nos exemplos).
  O `Header` deveria ter o contato de quem **desenvolveu** o feed; hoje vai o
  do anunciante. Trocar se o relatório reclamar.
- Limite de fotos: mínimo 5, máximo 7 MB cada, só JPG; máximo de quantidade
  não consta. Tamanho da foto não é conferido aqui.
- **Leads de volta**: o Grupo OLX entrega por **webhook** (POST JSON, um
  lead por requisição, `Authorization: Basic` com chave por CRM, até 3
  tentativas, idempotência por `originLeadId`, imóvel em `clientListingId`
  = nosso `ListingID`). Exige **homologação** do site como integrador:
  formulário do Grupo OLX + chave enviada por eles
  (`chamado.integracao@olxbr.com`). Não dá para fazer só do nosso lado. Ver
  também a decisão de escopo: funil de leads é outro projeto.
- **Importar anúncios existentes:** não há como ler do Canal Pro. Viável só
  a partir de um feed VRSync que o anunciante já tenha em outro sistema
  (ler o XML e criar os imóveis como rascunho, baixando as fotos). Só fazer
  se pedirem.
- Características além de piscina/pets/mobiliado: o site não guarda outras
  estruturadas (elevador, academia…), então não há o que mandar. A lista de
  valores aceitos está em `feeds/vrsync/elements/details.html`.
