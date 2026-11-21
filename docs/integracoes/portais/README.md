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
já tem cadastrados à mão no OLX/ZAP **não** são puxados para cá — não há API
pública de leitura do Canal Pro. Quem já anuncia lá cadastra aqui o que quer
manter e confirma com o gerente do Canal Pro, antes de ligar o feed, se os
anúncios manuais serão substituídos ou duplicados. (Se o anunciante usa outro
sistema que já gera um feed VRSync, dá para importar desse XML — não feito,
ver Pendente.)

A tela *Portais* tem o bloco **"Como funciona"** (`_components/como-funciona.tsx`)
com esta explicação em passo a passo, aberto enquanto a URL não foi gerada.
Mudou a regra aqui, muda o texto lá.

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

## Regras do VRSync que o gerador aplica

Um anúncio com problema **vermelho** não entra no feed (o portal recusaria);
**cinza** é aviso. A tela de Portais lista o que falta em cada anúncio.

| Regra do portal | Como fica aqui |
| --- | --- |
| Mínimo de **5 fotos**, só **JPG** | Fotos não-JPG ficam de fora; menos de 5 JPG bloqueia |
| Foto identificada pela URL; mudou a foto, a URL tem que mudar | O site regrava `1.jpg`, `2.jpg`… no mesmo caminho; o feed põe `?v=<updated_at>` |
| Título 10–100 caracteres | Bloqueia abaixo de 10; corta em 100 |
| Descrição 50–3000, texto | O HTML do editor vira texto; se ficar curta, completa com quartos/área/bairro |
| CEP obrigatório | Bloqueia sem `endereco_cep` (aba "Dados do contrato") |
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

- **Ainda não validado no validador oficial nem lido por um Canal Pro de
  verdade.** O XML segue a documentação pública e é bem formado, mas a
  documentação se contradiz em alguns pontos (onde fica o `ContactInfo`,
  `Iptu` × `YearlyTax`). Ajustar no primeiro relatório de integração.
- Frequência de leitura do portal e limite máximo de fotos: não constam nas
  páginas lidas.
- **Leads de volta** (contato feito no portal cair no sistema): o Grupo OLX
  tem integração de leads separada do feed. Fica para quando o feed estiver
  rodando.
- **Importar anúncios existentes:** não há como ler do Canal Pro. Viável só
  a partir de um feed VRSync que o anunciante já tenha em outro sistema
  (ler o XML e criar os imóveis como rascunho, baixando as fotos). Só fazer
  se pedirem.
- Características além de piscina/pets/mobiliado: o site não guarda outras
  estruturadas (elevador, academia…), então não há o que mandar.
