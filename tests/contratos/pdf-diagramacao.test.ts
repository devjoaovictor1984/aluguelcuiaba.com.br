// Diagramação do PDF do contrato (src/lib/crm/contrato-pdf.tsx).
//
// O react-pdf não gera bytes reproduzíveis (o subconjunto de fontes muda a
// cada render), então o que se compara é a ÁRVORE de elementos que o
// componente monta — essa é determinística.
//
//  - Legado: a árvore tem que bater com a fotografia em
//    __fotos__/contrato-legado.txt. É o layout que remonta contrato cujo
//    processo de assinatura começou antes do v2; mudar isso muda documento
//    que alguém já leu pra assinar. Se a mudança for intencional, apague a
//    fotografia e rode de novo — e explique no commit por quê.
//  - v2: confere as regras de quebra (órfãs/viúvas, título preso ao texto,
//    assinatura e linha de tabela indivisíveis).
//
// Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { ContratoDocument, type ContratoPDFData } from '@/lib/crm/contrato-pdf'
import { aplicarPlaceholdersV2 } from '@/lib/contratos/montar'
import { SEED_CLAUSULAS } from '@/lib/contratos/seed-modelo'

const React = createRequire(import.meta.url)('react') as typeof import('react')
const FOTO = new URL('./__fotos__/contrato-legado.txt', import.meta.url)

const dados = {
  locador: { nome: 'MARIA DE TESTE', cpf_cnpj: '52998224725', genero: 'F', profissao: 'professora', nacionalidade: 'brasileira', estado_civil: 'casado', rg: '1234567' },
  locatario: { nome: 'JOÃO DE TESTE', cpf_cnpj: '11144477735', genero: 'M', email: 'joao@exemplo.test' },
  admin: { nome: 'CORRETOR DE TESTE', razao_social: 'IMOBILIÁRIA TESTE LTDA', cnpj: '11222333000181' },
  imovel: { endereco_completo: 'Rua do Imóvel', endereco_numero: '50' },
  contrato: { valor_aluguel: 2000, data_inicio: '2026-12-01', duracao_meses: 30, dia_vencimento: 10 },
}

function montar(layout?: 'legado' | 'v2'): ContratoPDFData {
  const clausulas = SEED_CLAUSULAS.filter(c => c.tipo === 'generica').map((c, i) => ({
    numero: i + 1, titulo: c.titulo, corpo: aplicarPlaceholdersV2(c.corpo, dados, new Map()),
  }))
  return {
    codigo: '2026CT999', data_assinatura: '2026-11-11', incluir_capa: true, layout,
    resumo_capa: { aluguel_str: 'R$ 2.000,00 / mês', prazo_str: '30 meses', inicio_str: '01/12/2026', termino_str: '31/05/2029', garantia_str: 'Fiador', imovel_endereco: 'Rua do Imóvel, nº 50', imovel_descricao: 'Casa.' },
    anunciante_nome: 'CORRETOR DE TESTE', anunciante_razao_social: 'IMOBILIÁRIA TESTE LTDA', anunciante_cnpj: '11.222.333/0001-81',
    anunciante_creci: '00000-F', anunciante_creci_juridico: '00000-J', anunciante_logo_url: null,
    anunciante_endereco: 'Av. Teste, nº 1', anunciante_cidade_uf: 'Cuiabá-MT',
    locador_nome: 'MARIA DE TESTE', locador_cpf: '529.982.247-25', tem_administracao: true,
    admin_responsavel_nome: 'CORRETOR DE TESTE', admin_responsavel_creci: '00000-F',
    locatario_nome: 'JOÃO DE TESTE', locatario_cpf: '111.444.777-35', conjuge_nome: null, conjuge_cpf: null,
    moradores_adicionais: [{ nome: 'MORADOR UM', cpf: '123.456.789-09', papel: 'Morador' }],
    fiador_nome: 'FIADOR DE TESTE', fiador_cpf: '862.883.667-57',
    testemunhas: [], clausulas_seguradora_texto: null, clausulas,
    quadro_entrada: [
      { descricao: 'Primeiro aluguel', base: 'Período inicial', valor: 'R$ 2.000,00' },
      { descricao: 'Total da entrada', base: '—', valor: 'R$ 2.000,00' },
    ],
    tabela_12_meses: {
      colunas: { iptu: false, condominio: false, seguro: false }, antecipado: false, total_antecipado: '',
      linhas: Array.from({ length: 12 }, (_, i) => ({ parcela: i + 1, periodo: `mês ${i + 1}`, vencimento: '10', aluguel: 'R$ 2.000,00', iptu: null, condominio: null, seguro: null, total: 'R$ 2.000,00' })),
    },
    termo_chaves: { endereco_imovel: 'Rua do Imóvel, nº 50', data_entrega: '01/12/2026', qtd_chaves: 2, qtd_controles: 0, qtd_tags: 0, recebedores: [{ nome: 'JOÃO DE TESTE', cpf: '111.444.777-35' }] },
  }
}

// Nó da árvore já expandido (componentes-função resolvidos).
interface No { tipo: string; props: Record<string, unknown>; filhos: Array<No | string> }

function expandir(n: unknown): Array<No | string> {
  if (n == null || n === false || n === true) return []
  if (typeof n === 'string' || typeof n === 'number') return [String(n)]
  if (Array.isArray(n)) return n.flatMap(expandir)
  if (React.isValidElement(n)) {
    const el = n as React.ReactElement<Record<string, unknown>>
    if (el.type === React.Fragment) return expandir(el.props.children)
    if (typeof el.type === 'function') return expandir((el.type as (p: unknown) => unknown)(el.props))
    const { children, ...props } = el.props
    return [{ tipo: String(el.type), props, filhos: expandir(children) }]
  }
  return ['?']
}

function serializar(nos: Array<No | string>): string {
  return nos.map(n => typeof n === 'string'
    ? JSON.stringify(n)
    : `<${n.tipo} ${JSON.stringify(n.props, Object.keys(n.props).sort())}>${serializar(n.filhos)}</>`).join('')
}

const textoDe = (n: No | string): string => typeof n === 'string' ? n : n.filhos.map(textoDe).join('')
function todos(nos: Array<No | string>, f: (n: No) => boolean, acc: No[] = []): No[] {
  for (const n of nos) if (typeof n !== 'string') { if (f(n)) acc.push(n); todos(n.filhos, f, acc) }
  return acc
}

test('layout legado continua idêntico à fotografia', () => {
  const atual = serializar(expandir(ContratoDocument({ data: montar() })))
  // Sem layout e com layout 'legado' é a mesma coisa.
  assert.equal(serializar(expandir(ContratoDocument({ data: montar('legado') }))), atual)
  if (!existsSync(FOTO)) {
    mkdirSync(new URL('./__fotos__/', import.meta.url), { recursive: true })
    writeFileSync(FOTO, atual)
  }
  assert.equal(atual, readFileSync(FOTO, 'utf8'), 'o layout legado mudou — ver comentário no topo do teste')
})

test('v2: todo parágrafo de cláusula controla órfãs e viúvas', () => {
  const arvore = expandir(ContratoDocument({ data: montar('v2') }))
  const paragrafos = todos(arvore, n => n.tipo === 'TEXT' && /^\d+\.\d+\. /.test(textoDe(n)))
  assert.ok(paragrafos.length > 50)
  for (const p of paragrafos) {
    assert.equal(p.props.orphans, 2)
    assert.equal(p.props.widows, 2)
  }
})

test('v2: título de cláusula curta fica preso ao 1º parágrafo num bloco indivisível', () => {
  const arvore = expandir(ContratoDocument({ data: montar('v2') }))
  const titulos = todos(arvore, n => n.tipo === 'TEXT' && /^CLÁUSULA \d+ª — /.test(textoDe(n)))
  assert.equal(titulos.length, SEED_CLAUSULAS.filter(c => c.tipo === 'generica').length)
  const blocos = todos(arvore, n => n.tipo === 'VIEW' && n.props.wrap === false
    && /^CLÁUSULA \d+ª — /.test(textoDe(n)) && /\d+\.1\. /.test(textoDe(n)))
  assert.ok(blocos.length >= titulos.length - 2, `só ${blocos.length} de ${titulos.length} títulos presos`)
})

test('v2: blocos de assinatura e linhas de tabela não se partem', () => {
  const arvore = expandir(ContratoDocument({ data: montar('v2') }))
  // Bloco de assinatura = View que contém a linha de assinar (altura 0.6, marginTop 14).
  const ehLinhaAssinatura = (n: No | string) => typeof n !== 'string' && n.tipo === 'VIEW'
    && (n.props.style as { height?: number; marginTop?: number } | undefined)?.height === 0.6
    && (n.props.style as { marginTop?: number }).marginTop === 14
  const assinaturas = todos(arvore, n => n.tipo === 'VIEW' && n.filhos.some(ehLinhaAssinatura))
  assert.ok(assinaturas.length >= 5, `achei ${assinaturas.length} blocos de assinatura`)
  assert.ok(assinaturas.every(a => a.props.wrap === false))
  // Tabela dos 12 meses: indivisível inteira.
  const tabela = todos(arvore, n => n.tipo === 'VIEW' && textoDe(n).startsWith('Tabela dos 12 primeiros meses'))
  assert.equal(tabela[0]?.props.wrap, false)
  // Sumário NÃO pode ser indivisível (empurrava a página e deixava folha em branco).
  const sumario = todos(arvore, n => n.tipo === 'VIEW' && textoDe(n).startsWith('SUMÁRIO'))
  assert.notEqual(sumario[0]?.props.wrap, false)
})

test('v2: capa da administração respeita exclusividade e CNPJ da proprietária PJ', () => {
  const base = montar('v2')
  const adm: ContratoPDFData = {
    ...base, tipo_documento: 'administracao', exclusividade: false,
    locador_nome: 'EMPRESA TESTE LTDA', locador_cpf: '11.222.333/0001-81',
    proprietario_representante_nome: 'JOSÉ REPRESENTANTE', proprietario_representante_cpf: '529.982.247-25',
  }
  const texto = textoDe({ tipo: 'raiz', props: {}, filhos: expandir(ContratoDocument({ data: adm })) })
  assert.match(texto, /sem Exclusividade/)
  assert.match(texto, /EMPRESA TESTE LTDA — rep\. JOSÉ REPRESENTANTE11\.222\.333\/0001-81/)
})
