// Editor do documento do contrato: cláusula vazia, automáticas e
// duplicidade, textos padrão editáveis (tabela, inventário, termo de chaves).
// Ver src/lib/contratos/documento-textos.ts e docs/contratos-editor.md.
// Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  corpoVazio, separarClausulasVazias, verificarClausulasVazias, verificarDuplicidades,
  declaracaoInventarioPadrao, textoPersonalizado, ehOrigemAutomatica,
  TERMO_DEVOLUCAO_PADRAO, TABELA_OBSERVACAO_PADRAO,
} from '@/lib/contratos/documento-textos'
import { clausulasAutomaticas } from '@/lib/contratos/clausulas-automaticas'
import { ContratoDocument, type ContratoPDFData } from '@/lib/crm/contrato-pdf'

const React = createRequire(import.meta.url)('react') as typeof import('react')

// ── Cláusula vazia ──────────────────────────────────────────────────

test('vazia: só título, <p></p>, &nbsp; ou <br> não têm conteúdo', () => {
  for (const c of ['', '   ', '<p></p>', '<p>&nbsp;</p>', '<p><br></p>', '<p>​</p>', null]) {
    assert.equal(corpoVazio(c), true, JSON.stringify(c))
  }
})

test('vazia: texto curto, lista e tabela contam como conteúdo', () => {
  for (const c of ['<p>Ok.</p>', '<ul><li>a</li></ul>', '<table><tr><td></td></tr></table>', 'texto puro']) {
    assert.equal(corpoVazio(c), false, c)
  }
})

test('vazia: sai do PDF, os demais mantêm a ordem e o editor recebe aviso', () => {
  const lista = [
    { titulo: 'Das partes', corpo: '<p>A e B.</p>' },
    { titulo: 'Energia elétrica', corpo: '<p></p>' },
    { titulo: 'Do foro', corpo: '<p>Cuiabá.</p>' },
  ]
  const { mantidas, ignoradas } = separarClausulasVazias(lista)
  assert.deepEqual(mantidas.map(c => c.titulo), ['Das partes', 'Do foro'])
  assert.deepEqual(ignoradas.map(c => c.titulo), ['Energia elétrica'])
  const avisos = verificarClausulasVazias(lista)
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].severidade, 'warn')
  assert.match(avisos[0].rotulo, /Energia elétrica/)
})

// ── Automáticas e duplicidade ───────────────────────────────────────

const JONAS = { nome: 'JONAS DE TESTE', cpf_cnpj: '52998224725', profissao: 'advogado', genero: 'M' }
const CTX = {
  finalidade: 'comercial' as const, locatario_nome: 'RUI DE TESTE', tem_administracao: true,
  prazo_titularidade_dias_uteis: 10, imovel: { uc_energia: '6/123456-7' },
}

test('automáticas: cada uma com origem; sem usuário autorizado, nenhuma', () => {
  const com = clausulasAutomaticas(
    [{ papel: 'ocupante_autorizado', consumos_titular: ['energia'], pessoa: JONAS }], CTX)
  assert.deepEqual(com.map(c => c.origem), ['usuario_autorizado', 'titularidade'])
  assert.ok(com.every(c => ehOrigemAutomatica(c.origem)))
  assert.deepEqual(clausulasAutomaticas([{ papel: 'morador', pessoa: JONAS }], CTX), [])
  assert.deepEqual(clausulasAutomaticas(null, CTX), [])
})

test('duplicidade: cláusula manual sobre o mesmo assunto da automática vira alerta, sem remover', () => {
  const auto = clausulasAutomaticas([{ papel: 'ocupante_autorizado', pessoa: JONAS }], CTX)
  const clausulas = [{ titulo: 'Das partes' }, { titulo: 'Do Usuário Comercial Autorizado' }]
  const itens = verificarDuplicidades(clausulas, auto)
  assert.equal(itens.length, 1)
  assert.equal(itens[0].severidade, 'warn')
  assert.match(itens[0].rotulo, /Usuário Comercial Autorizado/)
})

test('duplicidade: a cópia personalizada (com origem) não conflita com a própria automática', () => {
  const auto = clausulasAutomaticas([{ papel: 'ocupante_autorizado', pessoa: JONAS }], CTX)
  const clausulas = [{ titulo: 'Do Usuário Comercial Autorizado', origem: 'usuario_autorizado' }]
  // a personalizada já tirou a automática da lista de ativas
  const ativas = auto.filter(a => !clausulas.some(c => c.origem === a.origem))
  assert.deepEqual(verificarDuplicidades(clausulas, ativas), [])
})

test('duplicidade: mesmo título duas vezes alerta, acento e caixa não importam', () => {
  const itens = verificarDuplicidades([{ titulo: 'Do Foro' }, { titulo: 'DO FORO' }, { titulo: 'Da multa' }], [])
  assert.equal(itens.length, 1)
  assert.match(itens[0].id, /duplicidade_titulo_do_foro/)
})

// ── Textos padrão ───────────────────────────────────────────────────

test('inventário: singular com um locatário, plural com dois, cita o usuário autorizado', () => {
  assert.match(declaracaoInventarioPadrao({ locatarios: 1 }), /^O LOCATÁRIO declara .* obriga-se/)
  assert.match(declaracaoInventarioPadrao({ locatarios: 2 }), /^Os LOCATÁRIOS declaram .* obrigam-se/)
  assert.match(
    declaracaoInventarioPadrao({ locatarios: 1, usuarioAutorizado: 'Usuário comercial autorizado' }),
    /por intermédio do USUÁRIO COMERCIAL AUTORIZADO/,
  )
})

test('devolução padrão não condiciona o recebimento das chaves à quitação', () => {
  assert.doesNotMatch(TERMO_DEVOLUCAO_PADRAO, /somente será considerada válida/)
  assert.match(TERMO_DEVOLUCAO_PADRAO, /sem que o recebimento das chaves dependa de sua prévia quitação/)
})

test('personalizado: vazio ou só espaços volta ao automático', () => {
  assert.equal(textoPersonalizado({ a: '  ' }, 'a'), null)
  assert.equal(textoPersonalizado({ a: 1 }, 'a'), null)
  assert.equal(textoPersonalizado(null, 'a'), null)
  assert.equal(textoPersonalizado({ a: ' x ' }, 'a'), 'x')
})

// ── PDF: textos editáveis chegam ao documento ───────────────────────

function textos(n: unknown): string[] {
  if (n == null || n === false || n === true) return []
  if (typeof n === 'string' || typeof n === 'number') return [String(n)]
  if (Array.isArray(n)) return n.flatMap(textos)
  if (React.isValidElement(n)) {
    const el = n as React.ReactElement<Record<string, unknown>>
    if (typeof el.type === 'function') return textos((el.type as (p: unknown) => unknown)(el.props))
    return textos(el.props.children)
  }
  return []
}

function base(): ContratoPDFData {
  return {
    codigo: '2026CT999', data_assinatura: '2026-11-11', incluir_capa: false,
    anunciante_nome: 'CORRETOR DE TESTE', anunciante_razao_social: null, anunciante_cnpj: null,
    anunciante_creci: null, anunciante_creci_juridico: null, anunciante_logo_url: null,
    anunciante_endereco: null, anunciante_cidade_uf: 'Cuiabá-MT',
    locador_nome: 'MARIA DE TESTE', locador_cpf: null, tem_administracao: true,
    admin_responsavel_nome: 'CORRETOR DE TESTE', admin_responsavel_creci: null,
    locatario_nome: 'RUI DE TESTE', locatario_cpf: null, conjuge_nome: null, conjuge_cpf: null,
    moradores_adicionais: [], fiador_nome: null, fiador_cpf: null,
    testemunhas: [], clausulas_seguradora_texto: null,
    clausulas: [{ numero: 1, titulo: 'Das partes', corpo: 'A e B.' }],
    inventario: [{ descricao: 'Mesa', quantidade: 1, marca_modelo: null, estado: 'bom', observacao: null }],
    quadro_entrada: [{ descricao: 'Primeiro aluguel', base: '—', valor: 'R$ 2.000,00' }],
    tabela_12_meses: {
      colunas: { iptu: false, condominio: false, seguro: false },
      linhas: [{ parcela: 1, periodo: 'mês 1', vencimento: '10', aluguel: 'R$ 2.000,00', iptu: null, condominio: null, seguro: null, total: 'R$ 2.000,00' }],
    },
    termo_chaves: {
      endereco_imovel: 'Sala 714', data_entrega: '01/12/2026', qtd_chaves: 2, qtd_controles: 0, qtd_tags: 1,
      recebedores: [
        { nome: 'RUI DE TESTE', cpf: null, papel: 'Locatário' },
        { nome: 'JONAS DE TESTE', cpf: null, papel: 'Usuário comercial autorizado', usuario_autorizado: true },
      ],
    },
  } as ContratoPDFData
}

const render = (d: ContratoPDFData) => textos(React.createElement(ContratoDocument, { data: d })).join(' ')

test('PDF: sem personalização mantém os textos legados', () => {
  const t = render(base())
  assert.match(t, /Os LOCATÁRIOS declaram receber os bens/)
  assert.match(t, /reajustado anualmente conforme cláusula de reajuste/)
  assert.match(t, /Termo de Entrega de Chaves/)
  assert.match(t, /somente será considerada válida/)
})

test('PDF: tabela, inventário e termo usam os textos personalizados', () => {
  const d = base()
  d.inventario_declaracao = 'O LOCATÁRIO declara receber os bens.'
  d.tabela_12_meses.observacao = TABELA_OBSERVACAO_PADRAO
  d.termo_chaves = {
    ...d.termo_chaves!,
    titulo: 'Termo de Entrega de Chaves e Acessos',
    texto_entrega: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
    observacoes: 'Vaga de garagem nº 12.',
    devolucao: TERMO_DEVOLUCAO_PADRAO,
  }
  const t = render(d)
  assert.match(t, /O LOCATÁRIO declara receber os bens\./)
  assert.doesNotMatch(t, /Os LOCATÁRIOS declaram/)
  assert.match(t, /escalonamento e reajuste previstas/)
  assert.match(t, /Termo de Entrega de Chaves e Acessos/)
  assert.match(t, /Primeiro parágrafo\..*Segundo parágrafo\./)
  assert.doesNotMatch(t, /entrega ao LOCATÁRIO, nesta data/)
  assert.match(t, /Vaga de garagem nº 12\./)
  assert.doesNotMatch(t, /somente será considerada válida/)
})

test('PDF: só o usuário autorizado recebe; o locatário assina ciente, não como "Locatário 2"', () => {
  const d = base()
  d.termo_chaves!.recebedores = d.termo_chaves!.recebedores.map(r => (r.usuario_autorizado ? r : { ...r, ciencia: true }))
  const t = render(d)
  assert.match(t, /LOCATÁRIO \(CIENTE DA ENTREGA\)/)
  assert.match(t, /USUÁRIO COMERCIAL AUTORIZADO \(RECEBI AS CHAVES\)/)
  assert.match(t, /As chaves serão recebidas por/)
  assert.doesNotMatch(t, /LOCATÁRIO 2/)
})
