# Importação de anúncios por XML (VRSync · ZAP antigo)

Início: 24/11/2026 (migration **v108**). É o caminho de volta dos
[Portais](../portais/README.md): lá o site **gera** o XML VRSync para o Canal
Pro; aqui o site **lê** o XML que o sistema de outra imobiliária já gera para
o ZAP / Viva Real / OLX e traz os imóveis de aluguel para cá.

## Por que XML VRSync

Não existe API para ler anúncios do Canal Pro. Mas todo sistema de
imobiliária que publica no Grupo OLX gera o mesmo arquivo, o VRSync
(<https://developers.grupozap.com/feeds/vrsync/>). A estrutura é a mesma em
todos; o que varia é o capricho (campo opcional que um manda e outro não,
IPTU mensal ou anual, HTML na descrição…). O leitor é tolerante: campo
faltando não derruba o imóvel, ele entra marcado para completar.

Também lê o **formato antigo do ZAP** (`<Carga><Imoveis><Imovel>`), que
sistemas mais velhos ainda geram. Qualquer outra raiz dá erro dizendo qual
tag veio.

## Fluxo

```
Painel → Importar → URL do XML  ─┐                      (ou o admin, para uma conta,
          ou envia o arquivo  ───┤                       em /admin/importacoes)
                                 ▼
                 1. ANÁLISE  baixa, lê, converte, compara com o que já existe
                             → grava 1 linha por imóvel em importacoes_itens
                             → PRÉVIA: novos, já importados, de fora e por quê,
                               bairros sem par (escolhe uma vez, fica salvo)
                                 ▼
                 2. IMPORTAR (opções)  → status 'importando'
                                 ▼
                 3. LOTES  a tela chama um lote (~50 s) atrás do outro:
                           cria/atualiza o imóvel + baixa e converte as fotos
                           (fechou a aba? continua quando voltar, ou o cron
                            termina de madrugada)
                                 ▼
                 concluída → desfazer · tentar erros de novo · pausar os que
                             sumiram do arquivo
```

## Regras

| Situação | O que acontece |
| --- | --- |
| Só venda (`For Sale`) | Fica de fora: o site é de aluguel |
| `Sale/Rent` | Entra (o valor de aluguel) |
| Diária / semana (`period="Daily"/"Weekly"`) | Fica de fora: temporada |
| Aluguel anual (`period="Yearly"`) | Vira mensal (÷ 12) |
| Outra cidade (`City` ≠ Cuiabá) | Fica de fora com o nome da cidade. Cidade vazia entra |
| Sem `ListingID` / sem valor | Fica de fora |
| Código repetido no arquivo | Fica o primeiro |
| Status do imóvel novo | **Rascunho**. Com "já publicar": vai ao ar se tiver bairro, valor, WhatsApp e ≥1 foto, até o limite do plano |
| Bairro | Casa sem acento/abreviação ("Jd." = Jardim, "CPA-I" = CPA 1, "Residencial X" = "X" quando é o único). O que não casar, o anunciante escolhe na prévia (`importacao_bairros`, por conta) |
| Tipo | `PropertyType` (Apartment, Penthouse, Kitnet, Home, Sobrado, Land Lot, Commercial/*…) → apartamento/casa/kitnet/terreno/comercial. Não reconhecido: casa (ou comercial) + aviso |
| IPTU | O site guarda mensal: `period="Yearly"`/`YearlyTax` ÷ 12. No ZAP antigo, IPTU maior que o aluguel é tratado como anual |
| Características | Pool/Pets Allowed/Furnished viram coluna; o resto (Elevator, Gym…) vai traduzido para o fim da descrição |
| Garantias | INSURANCE_GUARANTEE → fiança, SECURITY_DEPOSIT → caução (aviso: falta os meses), GUARANTOR → fiador. Outras viram aviso |
| Descrição | Todo HTML de origem é tirado e o texto é reescapado em `<p>`: nada do sistema de origem entra como HTML |
| WhatsApp | Telefone do `ContactInfo`; senão, o do perfil |
| Fotos | Até 20 (limite do site), principal primeiro. Vídeo não vem (aviso) |
| Endereço | Rua/número/complemento/CEP vão para os dados do contrato (não aparecem no anúncio, como sempre) |

### Fotos

Baixadas pelo servidor e **reconvertidas com sharp**: JPG (o único que o
portal aceita), girada pela orientação da câmera, máx. 1920 px, **sem
metadados** — foto de celular carrega o GPS da casa no EXIF, e o site só
mostra o bairro. Gravadas em `fotos-imoveis/<user>/<imovel>/imp-<lote>-<n>.jpg`.
Sem sharp no ambiente, só JPG sobe (sem reprocessar).

Custo: cada foto é ~50–100 ms de CPU. Uma imobiliária com 500 imóveis × 15
fotos ≈ 10 min de CPU da Vercel, uma vez (o plano hobby tem 4 h/mês de
Fluid Active CPU). Importação grande: preferir fazer fora do fim do mês.

### Reimportar (mesmo XML de novo, ou a sincronização diária)

O código de origem (`ListingID` / `CodigoImovel`) fica em
`imoveis.importacao_codigo`, **único por conta**: reimportar atualiza, não
duplica.

`imoveis.importacao_dados` guarda o que a importação gravou da última vez.
Na reimportação, campo a campo:

- igual ao que está aqui → nada;
- o anunciante **não mexeu** (está igual ao que a importação gravou) → atualiza;
- o anunciante **mexeu** → mantém o dele (a não ser "sobrescrever o que eu editei").

Fotos: só troca se mudaram na origem e ninguém mexeu nelas aqui. Status do
anúncio (no ar, pausado, alugado) a importação nunca muda — exceto "pausar os
que sumiram".

**Apagou aqui, não volta:** `excluirAnuncio` anota o código em
`importacao_descartados`; a próxima análise mostra "apagado aqui antes" e só
traz de volta se marcar.

**Sumiu do arquivo:** anúncio importado, no ar, cujo código não veio (ou veio
como só venda). Na importação manual, o anunciante vê a lista e escolhe quem
pausar. Na sincronização diária, pausa sozinho se a opção estiver ligada.
Escopo: só imóveis da mesma URL (ou, para arquivo enviado, os que vieram de
arquivo).

### Sincronização diária

URL importada fica salva (`importacoes_fontes`) com as opções da última
importação. Ligando "Atualizar sozinho todo dia", o cron
`/api/cron/importacoes` (07:00 UTC = 03:00 em Cuiabá, `vercel.json`):

1. termina importações que ficaram pela metade;
2. reimporta cada URL ligada (no máx. 1 vez a cada 20 h; deu erro, tenta
   amanhã e o erro aparece na tela).

Teto de ~4 min por execução; o que não couber segue no dia seguinte.

## Segurança

- **SSRF:** o servidor baixa a URL que alguém digitou. `src/lib/importacao/baixar.ts`
  usa `http`/`https` com `lookup` próprio que recusa IP privado, loopback,
  link-local (169.254.169.254, metadados da nuvem), CGNAT, IPv6 local — na
  hora da conexão, então DNS que troca de IP não passa. Redirecionamento
  seguido à mão (máx. 5), cada salto com a mesma regra. Teto de tamanho (XML
  80 MB, foto 25 MB) e de tempo.
- **XML:** DOCTYPE removido antes do parser (XXE / "billion laughs");
  `fast-xml-parser` não resolve entidade externa e tem limite de expansão.
- **Acesso:** as server actions (`painel/anuncios/importar/actions.ts`)
  conferem dono/admin antes de tudo; o motor usa o cliente de serviço. As
  tabelas novas têm RLS ligado **sem política** (só o servidor lê).
- **Arquivo enviado:** sobe do navegador direto para o bucket **privado**
  `importacoes` por URL assinada (server action só aceita 1 MB). O caminho é
  `<conta>/<uuid>.xml` e a action confere que é da conta. Apagado ao concluir
  ou cancelar.
- **Uma importação por vez por conta** (duas brigariam pelos mesmos códigos)
  e 30 por hora por usuário (fora admin). A fila usa `FOR UPDATE SKIP LOCKED`
  (RPC `importacao_reservar`): duas abas não processam o mesmo item; item
  preso há 10 min volta para a fila; 3 falhas → erro.

## No sistema

| Peça | Onde |
| --- | --- |
| Migration | `supabase/migrations/crm_v108_importacao_xml.sql` |
| Ler XML (formato, encoding, gzip) | `src/lib/importacao/xml.ts` |
| Converter para as colunas do site | `src/lib/importacao/mapear.ts` |
| Bairros (normalizar, casar) | `src/lib/importacao/bairros.ts` |
| Download seguro | `src/lib/importacao/baixar.ts` |
| Fotos (sharp + storage) | `src/lib/importacao/fotos.ts` |
| Análise, lotes, reimportação, desfazer | `src/lib/importacao/motor.ts` |
| Ações (acesso) | `src/app/(auth)/painel/anuncios/importar/actions.ts` |
| Telas | `src/app/(auth)/painel/anuncios/importar/` (lista e `[id]`) |
| Admin (todas as contas + importar para uma) | `src/app/admin/importacoes/` |
| Cron | `src/app/api/cron/importacoes/route.ts` |
| Testes | `tests/importacao/importacao.test.ts` (ida e volta com o gerador dos Portais, ISO-8859-1, gzip, ZAP antigo, venda/temporada/cidade, bairros) |

Dados novos (v108): colunas `importacao_codigo`, `importacao_fonte_id`,
`importado_em`, `importacao_dados` em `imoveis`; tabelas `importacoes_fontes`,
`importacoes`, `importacoes_itens`, `importacao_bairros`,
`importacao_descartados`; RPC `importacao_reservar`; bucket `importacoes`.

## O que NÃO vem

Proprietário, contrato, chaves, vídeos, tour virtual, características sem
coluna aqui (vão no texto). O XML só traz o anúncio.

**Cuidado com os Portais:** se o sistema antigo continuar mandando os mesmos
imóveis para o Canal Pro, **não ligue** os importados no feed daqui — o
portal recusa como duplicado. Primeiro desliga lá, depois liga aqui.

## Pendente / não confirmado

- **Ainda não testado com o arquivo de uma imobiliária real.** Testado com o
  XML que o próprio site gera (ida e volta) e com exemplos montados à mão de
  VRSync e ZAP antigo. O primeiro arquivo real mostra o que ajustar em
  `mapear.ts` (tipos com nome diferente, campo em outro lugar).
- Formatos fora VRSync/ZAP antigo (Imovelweb, OLX antigo, planilha): não lidos.
  Dá para somar um adaptador em `xml.ts` + `mapear.ts` quando aparecer um.
- Código de origem é único **por conta**: duas URLs diferentes da mesma conta
  com o mesmo código se confundem. Na prática uma conta = um sistema.
- Imóvel sem latitude/longitude no XML entra sem pino no mapa (não chama o
  geocode automaticamente, para não gastar cota em lote).
- Cidade: só Cuiabá (o site não tem outras). Quando virar multi-cidade
  (visão SaaS), trocar `CIDADE_SITE` em `motor.ts` pela cidade da conta.
