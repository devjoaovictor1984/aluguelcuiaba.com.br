# AluguelCuiabá — Dossiê Técnico da Plataforma

> Documento de apoio para apresentação a parceiros e clientes.
> Base de dados técnica: maio/2026. Valores de fornecedores são de referência (jan/2026) — confirmar nos sites oficiais.

---

## 1. Resumo executivo

O **AluguelCuiabá** é uma plataforma web completa para o mercado de locação de imóveis. Cobre todo o ciclo: **atração do inquilino** (site público com SEO e blog), **gestão da carteira** (CRM com clientes, imóveis e financeiro) e **formalização** (geração automática de contratos de locação, administração e aditivos em PDF jurídico).

Não é um site institucional — é uma **aplicação SaaS na nuvem**, multi-tenant (vários clientes no mesmo sistema, dados isolados), pronta para ser replicada por cidade.

---

## 2. As três peças de infraestrutura (explicação simples)

Pense numa loja física: você precisa do **prédio**, do **estoque/cofre** e do **carteiro**. Na nuvem é a mesma lógica.

### ▲ Vercel — *onde o sistema roda* (o "prédio")
Empresa criadora do Next.js. Hospeda a aplicação e o site.
- **Deploy automático:** toda alteração de código entra no ar em segundos.
- **CDN global:** o conteúdo é entregue de servidores espalhados pelo mundo → site rápido em qualquer lugar.
- **Escala automática (serverless):** lida com picos de acesso sem servidor parado custando dinheiro.

### ⚡ Supabase — *onde os dados ficam* (o "cofre")
Banco de dados e autenticação na nuvem, sobre **PostgreSQL** (o banco relacional mais robusto e confiável do mercado).
- **Banco de dados:** guarda imóveis, clientes, contratos, parcelas, etc. (49 versões de estrutura já evoluídas com segurança).
- **Autenticação:** login dos corretores e do administrador.
- **RLS (Row Level Security):** cada cliente só enxerga os próprios dados — regra imposta pelo **banco**, não só pela tela. Camada extra de segurança.
- **Storage:** fotos, documentos e PDFs.

### ✉ Resend — *quem envia os e-mails* (o "carteiro")
Serviço de envio de e-mail transacional com alta entregabilidade (não cai em spam).
- Boas-vindas, avisos de vencimento, recibos, comunicação com clientes.
- Complementado por **notificações push** (web e celular) para avisos instantâneos.

**Resumo:** Vercel hospeda · Supabase guarda os dados · Resend envia os e-mails.

---

## 3. Linguagens e ferramentas (stack)

| Camada | Tecnologia | Para que serve |
|---|---|---|
| Framework | **Next.js 16** + **React 19** | Site + aplicação; renderização no servidor (rápido e bom pra SEO) |
| Linguagem | **TypeScript** | JavaScript com tipos → menos bugs, mais seguro de manter |
| Estilo | **Tailwind CSS 4** | Design responsivo e consistente |
| Banco/Auth | **Supabase** (PostgreSQL) | Dados, login, storage, segurança por linha (RLS) |
| Hospedagem | **Vercel** | Deploy, CDN global, escala automática |
| E-mail | **Resend** | E-mails transacionais |
| Pagamentos | **Stripe** | Cobrança e assinaturas (billing das imobiliárias) |
| Monitoramento | **Sentry** | Captura de erros em tempo real |
| PDF | **react-pdf** + **pdf-lib** | Geração e montagem dos contratos em PDF |
| Editor | **TipTap** | Edição rica de cláusulas e conteúdo |
| Mapas | **Leaflet** | Localização dos imóveis |
| App | **PWA** + **Web Push** | Instalável no celular, com notificações |

---

## 4. Módulos do produto (em produção)

**Painel do corretor / imobiliária (CRM):**
- **Início** — dashboard da operação.
- **Anúncios** — imóveis, fotos, mapa, página pública com SEO.
- **Clientes** — proprietários, inquilinos, fiadores, cônjuges e documentos.
- **Contratos de locação** — editor de cláusulas (arrastar e soltar), PDF jurídico com capa, sumário clicável, numeração de cláusulas, inventário de bens, termo de chaves e **aditivos**.
- **Administrações** — contrato de administração imobiliária (proprietário × imobiliária), com exclusividade, comissões e controle de vencimento/renovação.
- **Financeiro** — parcelas, boletos, repasses, comissões, recibos.
- **Cobranças** — vencimentos e lembretes.
- **Reajustes** — histórico e aplicação por índice.
- **Vistorias** — entrada/saída com fotos e assinatura.
- **Agenda**, **Relatórios**, **Lixeira** (soft delete), **Perfil**, **Ajuda**.

**Admin master (operação do SaaS):**
- Usuários, site público, banners, blog (posts), categorias, bairros, geocodificação.
- E-mails e envios, notificações push, sugestões dos usuários.
- **Seguros** — módulo já preparado para integração com seguradoras parceiras.

---

## 5. Arquitetura e segurança

- **Multi-tenant nativo:** um único sistema atende todos os clientes; cada um é isolado por `user_id` + RLS. Ninguém vê dados de outro.
- **Segurança no banco:** o isolamento é imposto pelo PostgreSQL (RLS), não apenas pela interface.
- **LGPD:** dados pessoais tratados por finalidade; cláusula de proteção de dados nos próprios contratos.
- **Soft delete + lixeira:** exclusões são reversíveis.
- **Observabilidade:** erros monitorados em tempo real (Sentry).
- **Contratos com base legal:** Lei nº 8.245/1991 (Inquilinato), Código Civil, MP 2.200-2/2001 (assinatura eletrônica).

---

## 6. Modelo SaaS multi-cidade

A arquitetura **já é multi-tenant** — Cuiabá e qualquer outra cidade rodam no mesmo sistema, ao mesmo tempo.

- **Deploy único:** uma melhoria entra no ar **para todas as cidades simultaneamente**. Não se reescreve nada por praça.
- **SEO por cidade:** cada cidade tem suas páginas, anúncios e blog → ranqueia localmente no Google.
- **Cobrança por praça:** cada imobiliária/cidade é uma assinatura (Stripe) → receita recorrente.
- **Estratégia:** Cuiabá como praça-piloto (blog + tráfego pago para validar), depois replica o motor para novas cidades.

> Caminhos técnicos de white-label (domínio próprio por cidade, tema por praça) são incrementais — a base já comporta.

---

## 6.1 Modelo de franquia digital (white-label)

A mesma arquitetura sustenta um modelo de **franquia**: cada cidade é uma unidade, com domínio próprio e um responsável local — mas o produto é um só.

**Como funciona:**
- **Matriz** desenvolve e mantém o sistema (código, produto, infraestrutura, qualidade). Toda melhoria entra no ar **para toda a rede ao mesmo tempo**.
- **Franqueado** opera a praça dele **pelo painel**: capta imóveis, escreve o blog local, atende leads e gera contratos. **Não toca no código nem no layout** — isso é centralizado, o que garante padrão e qualidade iguais em todas as cidades.
- **Cada cidade** tem **domínio próprio** (ex.: `aluguelcampogrande.com.br`) apontando para o mesmo sistema; um roteador identifica a cidade pelo domínio.
- **Personalização local** (logo, cor, contato, textos) é **configuração no banco**, não código.

**Papéis de acesso:** super-admin (matriz) · admin-da-cidade (franqueado, vê só a praça dele) · corretor.

**Por que isso é forte:**
- Economia de escala: um time de produto serve o país inteiro.
- Padronização: marca e qualidade iguais em toda a rede.
- Receita recorrente: mensalidade/royalty por unidade (via Stripe, já instalado).

**Trade-off a gerir:** deploy único significa que uma falha na matriz afeta todos — por isso há disciplina de testes e rollback (a Vercel facilita ambientes de pré-visualização e reversão).

---

## 7. Capacidade e escalabilidade

| Dimensão | Capacidade atual | Quando expandir |
|---|---|---|
| Visitas no site público | Praticamente ilimitado (CDN/cache) | Não é gargalo; escala sozinho |
| Imobiliárias/corretores logados | Milhares de usuários ativos/mês | Acima disso: subir o plano do banco |
| Banco de dados | Milhões de registros (PostgreSQL) | > ~8 GB de dados → add-on de armazenamento/compute |
| E-mails | Conforme volume contratado | Sobe a faixa conforme disparos/mês |

**Leitura de negócio:** o site (que atrai tráfego) escala de forma quase ilimitada e barata. O custo de banco só cresce de verdade quando há **muitas imobiliárias pagantes** — ou seja, **o custo acompanha a receita**.

---

## 8. Custos de infraestrutura (referência)

| Serviço | Plano inicial | Faixa de referência* |
|---|---|---|
| Vercel | Pro | ~US$ 20/mês |
| Supabase | Pro | ~US$ 25/mês |
| Resend | Free → Pro | US$ 0 a ~20/mês |
| Sentry | Free | US$ 0 no início |
| Stripe | Sob demanda | % por transação |

**Operação inicial:** ~**US$ 45–65/mês** para começar; escala conforme cidades e clientes pagantes.

\* Valores de referência (base jan/2026). Confirmar nos sites oficiais — planos e preços mudam.

---

## 9. Onde a seguradora entra (foco da reunião)

Todo contrato de locação gerado na plataforma **exige seguro fiança e/ou incêndio** — as cláusulas já estão no sistema, fundamentadas na Lei do Inquilinato. **Cada contrato é um lead qualificado de seguro.**

- **Gancho já existe:** módulo "Seguros" no admin, preparado para plugar a seguradora no fluxo do imóvel e do contrato.
- **No momento certo:** o seguro é oferecido durante a montagem do contrato — não depois.
- **Dados prontos:** imóvel, valor do aluguel, partes e datas já cadastrados → cotação com poucos cliques.
- **Volume escalável:** SaaS multi-cidade = funil nacional de seguros, alimentado por contratos reais.

### Proposta de parceria
1. **Integração de cotação/contratação** de seguro fiança e incêndio dentro da plataforma.
2. **Comissionamento / split** por apólice originada.
3. **Co-marketing** — seguradora como parceira oficial (site e blog), em Cuiabá e demais cidades.
4. **Piloto em Cuiabá** com expansão conforme o modelo SaaS.

---

## 9.1 Projeções de receita — Cuiabá (piloto)

> Projeções **ilustrativas**, baseadas nas premissas abaixo. Não constituem garantia de resultado.

### As três fontes de receita

| Fonte | Periodicidade | O que é | Quem paga |
|---|---|---|---|
| **Mensalidade do sistema** | Mensal (recorrente) | Assinatura da plataforma: R$ 49,90/mês (até 10 imóveis) ou R$ 99,90/mês (ilimitado) | A imobiliária / corretor |
| **Seguro fiança** | Mensal (recorrente) | Garantia que substitui o fiador; cobrada todo mês no boleto (≈ 13% do aluguel). Plataforma ganha comissão | O inquilino |
| **Seguro incêndio** | Anual | Cobertura do imóvel, obrigatória por lei; paga 1× por ano (≈ R$ 200/ano). Plataforma ganha comissão | O inquilino |

As duas primeiras repetem todo mês enquanto durar o contrato; a terceira renova a cada ano.

### Premissas
- 4.000 corretores/imobiliárias ativos em Cuiabá (≈ 650 mil hab.)
- 10 imóveis administrados por assinante (faixa 5–15)
- Aluguel médio R$ 2.250 (faixa R$ 1.500–3.000)
- Mensalidade média por assinante R$ 74,90 (média dos dois planos: R$ 49,90 e R$ 99,90)
- **Prêmio do seguro fiança:** 13% do aluguel/mês → ≈ **R$ 3.510/ano** por imóvel
- **Prêmio do seguro incêndio:** ≈ **R$ 200/ano** por imóvel
- Cada imóvel administrado = 1 apólice de fiança + 1 de incêndio por ano (renováveis)

### 1) Receita recorrente da plataforma (assinaturas)

| Cenário | Adesão | Assinantes | **Assinaturas/ano** | Por mês |
|---|---|---|---|---|
| Pessimista | 5% | 200 | **R$ 179,8 mil** | ~R$ 15 mil |
| Realista | 10% | 400 | **R$ 359,5 mil** | ~R$ 30 mil |
| Otimista | 20% | 800 | **R$ 719,0 mil** | ~R$ 60 mil |

> Só a mensalidade do sistema, sem contar seguro. É a base previsível e recorrente.

### 2) Seguro canalizado (relevante para a seguradora)

Prêmio anual = fiança (R$ 3.510) + incêndio (R$ 200) = **R$ 3.710 por imóvel/ano**.

| Cenário | Imóveis / apólices | Fiança/ano | Incêndio/ano | **Prêmio total/ano** |
|---|---|---|---|---|
| Pessimista | 2.000 | R$ 7,02 mi | R$ 0,40 mi | **R$ 7,4 mi** |
| Realista | 4.000 | R$ 14,04 mi | R$ 0,80 mi | **R$ 14,8 mi** |
| Otimista | 8.000 | R$ 28,08 mi | R$ 1,60 mi | **R$ 29,7 mi** |

> Tudo isso é **só em Cuiabá**. A expansão por cidade (franquia) multiplica o volume — cada nova praça adiciona seu próprio funil de apólices.

**Como ler:** a receita própria e garantida da plataforma são as assinaturas. O seguro mostra o **volume de prêmios** (fiança + incêndio) que a plataforma canaliza — o que a seguradora fatura. A forma de remuneração da parceria fica em aberto, para a seguradora propor.

---

## 10. Roteiro sugerido da demo ao vivo

1. **Site público** — abrir um anúncio, mostrar SEO/visual e o blog.
2. **CRM** — listar imóveis e clientes; abrir um contrato.
3. **Gerar contrato de locação** — mostrar o editor de cláusulas e o **PDF final** (capa, sumário, cláusulas de seguro fiança/incêndio, assinaturas).
4. **Contrato de administração** — mostrar exclusividade, comissões e o **painel de vencimentos/renovação**.
5. **Módulo Seguros** (admin) — mostrar o gancho preparado para a parceria.
6. Fechar no **deck** (slides 14–15): onde a seguradora entra e a proposta.

---

## 11. Pontos fortes para destacar

- Produto **real e funcionando**, não protótipo.
- Custo de operação **baixo** e que **cresce junto com a receita**.
- **Escalável por cidade** sem reescrita (deploy único atende todos).
- **Seguro no fluxo**, no momento da decisão — não como venda separada.
- Base **jurídica sólida** nos contratos (Lei 8.245/91 e correlatas).
