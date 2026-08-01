import 'server-only'

/**
 * Simulador da API Maximiza — para demonstrar o produto enquanto a
 * credencial de homologação não chega.
 *
 * Substitui APENAS a chamada HTTP, no ponto mais baixo da pilha. Tudo
 * acima — mapper, validação, persistência, telas — é o código real. Isso
 * tem dois efeitos:
 *
 *  1. o vídeo mostra o sistema de verdade, não uma maquete;
 *  2. quando a credencial chegar, o caminho já foi exercitado; só o fetch
 *     muda.
 *
 * ⚠️ TRAVA DE SEGURANÇA: recusa rodar com MAXIMIZA_AMBIENTE=1. Nunca há
 * como um dado simulado se passar por apólice de produção.
 *
 * Ligar com MAXIMIZA_DEMO=1 no .env.local. Ausente = comportamento real.
 */

export function simuladorAtivo(): boolean {
  if (process.env.MAXIMIZA_DEMO !== '1') return false
  if (process.env.MAXIMIZA_AMBIENTE === '1') {
    throw new Error(
      'MAXIMIZA_DEMO=1 com MAXIMIZA_AMBIENTE=1 (produção). ' +
      'Simulação em produção geraria apólice falsa — use ambiente 2.',
    )
  }
  return true
}

/** Latência fingida: sem ela a tela não mostra os estados de carregando. */
function demorar(min = 500, max = 1100): Promise<void> {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)))
}

const SEGURADORAS = [
  { seguradora: 'Porto Seguro', sigla: 'porto', analiseReduzida: 'sim' },
  { seguradora: 'Too Seguros',  sigla: 'too',   analiseReduzida: 'sim' },
  { seguradora: 'Pottencial',   sigla: 'ptc',   analiseReduzida: 'sim' },
  { seguradora: 'Tokio Marine', sigla: 'tok',   analiseReduzida: 'não' },
]

/**
 * O último dígito do CPF escolhe o cenário. Assim dá pra demonstrar um
 * caso específico de propósito, e o mesmo CPF sempre dá o mesmo resultado
 * — repetir a gravação não muda o roteiro.
 *
 *   final 9 → todas recusam
 *   final 8 → pré-aprovado, aguardando biometria
 *   final 7 → aprovado com limite inferior
 *   final 6 → todas ainda analisando
 *   outros → aprovado pela maioria (caminho feliz)
 */
function cenarioDoCpf(cpf: string): 'recusado' | 'biometria' | 'parcial' | 'analisando' | 'aprovado' {
  const d = cpf.replace(/\D/g, '').slice(-1)
  if (d === '9') return 'recusado'
  if (d === '8') return 'biometria'
  if (d === '7') return 'parcial'
  if (d === '6') return 'analisando'
  return 'aprovado'
}

function moedaParaNumero(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

interface ParecerSimulado {
  seguradora: string
  sigla: string
  codigoStatus: number
  descricaoStatus: string
  statusBiometria: number
  codigoAnalise: number
  msg: string
  limiteAprovado?: number
}

function pareceres(cpf: string, aluguel: number, siglas: string[]): ParecerSimulado[] {
  const cenario = cenarioDoCpf(cpf)
  const alvo = SEGURADORAS.filter(s => !siglas.length || siglas.includes(s.sigla))
  const codigo = () => 909000000000 + Math.floor(Math.random() * 999999999)

  return alvo.map((s, i) => {
    const base = {
      seguradora: s.seguradora,
      sigla: s.sigla,
      statusBiometria: 0,
      codigoAnalise: codigo(),
      msg: '',
    }

    if (cenario === 'recusado') {
      return { ...base, codigoStatus: 3, descricaoStatus: 'Recusado',
        msg: i === 0 ? 'Pendência financeira em consulta a bureau de crédito.' : '' }
    }
    if (cenario === 'analisando') {
      return { ...base, codigoStatus: 2, descricaoStatus: 'Em análise' }
    }
    if (cenario === 'biometria' && i === 0) {
      return {
        ...base,
        codigoStatus: 12,
        descricaoStatus: 'Pre-Aprovado. Necessaria Biometria para aprovacao completa',
        msg: 'Envie o link ao pretendente para concluir a aprovação.',
      }
    }
    if (cenario === 'parcial') {
      const limite = Math.round(aluguel * 0.8)
      return i % 2 === 0
        ? { ...base, codigoStatus: 5, descricaoStatus: 'Aprovado com limite inferior ao solicitado',
            limiteAprovado: limite,
            msg: 'O cadastro foi aprovado, mas com limite insuficiente para cobertura total do aluguel e encargos. Será necessário incluir um locatário solidário para aumento de limite.' }
        : { ...base, codigoStatus: 3, descricaoStatus: 'Recusado' }
    }

    // Caminho feliz: a última fica em análise, pra tela mostrar os dois
    // estados convivendo — é assim que costuma chegar na vida real.
    if (i === alvo.length - 1) {
      return { ...base, codigoStatus: 2, descricaoStatus: 'Em análise' }
    }
    return { ...base, codigoStatus: 1, descricaoStatus: 'Aprovado', limiteAprovado: aluguel }
  })
}

/** Preços coerentes com o aluguel — ~7,8 aluguéis de prêmio. */
function planos(aluguel: number) {
  const premio = Math.round(aluguel * 7.8 * 100) / 100
  const p29 = Math.round((premio / 29) * 100) / 100
  const p12 = Math.round((premio / 12) * 1.09 * 100) / 100
  const opcao = (forma: string, plano: string, parcelas: number, valor: number, entrada = 0) => ({
    entrada_pagto: entrada,
    forma_pagto_descricao: forma,
    tipo_plano: plano,
    qtd_parcelas: parcelas,
    valor_parcela: valor,
  })

  return {
    plano_basico: {
      fatura: [opcao('Fatura', 'basic', 29, Math.round(p29 * 0.82 * 100) / 100)],
      boleto: [opcao('Boleto', 'basic', 1, Math.round(premio * 0.82 * 100) / 100, 1)],
    },
    plano_completo: {
      fatura: [opcao('Fatura', 'complete', 29, Math.round(p29 * 1.22 * 100) / 100)],
      boleto: [opcao('Boleto', 'complete', 1, Math.round(premio * 1.22 * 100) / 100, 1)],
      cartao: [opcao('Cartão de Crédito', 'complete', 12, Math.round(p12 * 1.22 * 100) / 100)],
    },
    plano_tradicional: {
      fatura: [opcao('Fatura', 'traditional', 29, p29)],
      ficha:  [opcao('Ficha', 'traditional', 29, p29)],
      boleto: [opcao('Boleto', 'traditional', 1, premio, 1)],
      cartao: [opcao('Cartão de Crédito', 'traditional', 12, p12)],
    },
  }
}

/* ── Roteador ──────────────────────────────────────────────────────── */

type Corpo = Record<string, unknown>

/**
 * Responde como a API responderia. Formato idêntico ao documentado —
 * inclusive as inconsistências (sigla `por` da Porto, valores em string
 * PT-BR), justamente pra exercitar o mapper de verdade.
 */
export async function simular(caminho: string, corpo?: unknown): Promise<unknown> {
  await demorar()
  const c = (corpo ?? {}) as Corpo

  if (caminho.includes('seguradorasAnalise')) return SEGURADORAS

  if (caminho.includes('listarCNAE')) {
    return [
      { id: '23879', descricao: 'Administração da Infra-estrutura Portuária' },
      { id: '30717', descricao: 'Comércio varejista de artigos do vestuário' },
      { id: '31544', descricao: 'Restaurantes e similares' },
    ]
  }

  if (caminho.includes('consultarImobiliaria')) {
    // Vazio força o cadastro — exercita o fluxo de provisionamento.
    return {}
  }

  if (caminho.includes('cadastrarImobiliaria')) {
    return {
      id: 400000 + Math.floor(Math.random() * 99999),
      msg: `Imobiliária ${c.fantasia ?? ''} cadastrada com sucesso.`,
    }
  }

  if (caminho.includes('transmitirAnalise') || caminho.includes('transmitirReanalise')) {
    const pretendente = (c.pretendente ?? {}) as Corpo
    const imovel = (c.imovel ?? {}) as Corpo
    const cpf = String(pretendente.cpf ?? '')
    const aluguel = moedaParaNumero(imovel.aluguel)
    const siglas = Array.isArray(c.seguradorasAnalise) ? (c.seguradorasAnalise as string[]) : []

    return {
      id: Number(c.codigo) || 210000 + Math.floor(Math.random() * 89999),
      analises: pareceres(cpf, aluguel || 1500, siglas),
    }
  }

  if (caminho.includes('consultarPrecosApi')) {
    // O prêmio deriva dos encargos, como na API real.
    const encargos = ['condominio', 'gas', 'iptu', 'energia', 'agua']
      .reduce((s, k) => s + moedaParaNumero(c[k]), 0)
    return planos(1500 + encargos * 3)
  }

  if (caminho.includes('contratar')) {
    return { msg: 'Dados salvos com sucesso! Iniciado o processo de transmissão do seguro.' }
  }

  // GET /apiFiancaAnalise/{id}
  const m = caminho.match(/apiFiancaAnalise\/(\d+)/)
  if (m) {
    return {
      id: Number(m[1]),
      dadosAnalise: { corretora: '99', simulado: true },
      analises: pareceres('0', 1500, []).map(p => ({ ...p, base64Pdf: [] })),
    }
  }

  throw new Error(`Simulador não cobre o endpoint ${caminho}.`)
}
