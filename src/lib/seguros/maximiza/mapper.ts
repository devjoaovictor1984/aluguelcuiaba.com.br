import 'server-only'
import {
  estadoCivilParaMaximiza, indiceReajusteParaMaximiza, tipoImovelParaMaximiza,
  normalizarSigla, seguradoraIntegrada,
} from '../tabelas'
import type {
  AnaliseInput, ContratacaoInput, Parecer, PlanosPreco, ResultadoAnalise,
  Seguradora, OpcaoPagamento, ArquivoRecebido,
} from '../tipos'

/**
 * Tradução entre o domínio do CRM e o formato da Maximiza.
 *
 * A API mistura convenções no mesmo fluxo — valor em string PT-BR na
 * análise ("1.500,00") e number decimal na contratação (238.26), data em
 * dd/MM/yyyy, enum como string numérica. Tudo isso fica preso aqui: fora
 * deste arquivo o app só conhece number, boolean e data ISO.
 */

/* ── Primitivos ────────────────────────────────────────────────────── */

/** number → "1.500,00" (o formato que a análise exige). */
export function valorPtBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0,00'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** ISO (yyyy-MM-dd) → dd/MM/yyyy. */
export function dataPtBr(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : undefined
}

export function simNao(v: boolean | null | undefined): 'S' | 'N' {
  return v ? 'S' : 'N'
}

export function umZero(v: boolean | null | undefined): 0 | 1 {
  return v ? 1 : 0
}

/**
 * Separa DDD do número. Nosso cadastro guarda o telefone num campo só,
 * em formatos variados ("(65) 99999-8888", "65999998888").
 */
export function separarDdd(fone: string | null | undefined): { ddd: string; numero: string } {
  const d = (fone ?? '').replace(/\D/g, '')
  const semPais = d.length > 11 && d.startsWith('55') ? d.slice(2) : d
  if (semPais.length < 10) return { ddd: '', numero: semPais }
  const ddd = semPais.slice(0, 2)
  const resto = semPais.slice(2)
  // A API espera o número com hífen: 99999-8888 / 9999-8888
  const numero = resto.length === 9
    ? `${resto.slice(0, 5)}-${resto.slice(5)}`
    : `${resto.slice(0, 4)}-${resto.slice(4)}`
  return { ddd, numero }
}

/* ── Análise (saída) ───────────────────────────────────────────────── */

export function montarAnalise(input: AnaliseInput, opcoes: {
  ambiente: 1 | 2
  cnpjImobiliaria: string
  reanaliseDe?: number
}): Record<string, unknown> {
  const { pretendente: p, imovel: i } = input
  const cel = separarDdd(p.celular)
  const tel = separarDdd(p.telefone)
  const completa = input.tipoAnalise === 'completa'

  const corpo: Record<string, unknown> = {
    ambiente: opcoes.ambiente,
    imobiliaria: { cnpj: opcoes.cnpjImobiliaria },
    pretendente: {
      tipoInquilino: p.tipo,
      nome: p.nome,
      cpf: p.cpfCnpj,
      celular: cel.numero,
      dddCelular: cel.ddd,
      email: p.email,
    },
    imovel: {
      cep: i.cep,
      aluguel: valorPtBr(i.aluguel),
      pinturaNova: umZero(i.pinturaNova),
      finalidade: i.finalidade,
      periodoContratoLocacao: i.periodoContratoMeses,
    },
  }

  if (input.seguradoras?.length) corpo.seguradorasAnalise = input.seguradoras
  if (opcoes.reanaliseDe) corpo.codigo = opcoes.reanaliseDe

  // A análise reduzida para por aqui — é o formulário de 2 minutos.
  if (!completa && i.finalidade === 'R') return corpo

  const pret = corpo.pretendente as Record<string, unknown>
  pret.dataNascimento = dataPtBr(p.dataNascimento)
  pret.sexo = p.sexo ?? undefined
  if (p.telefone) {
    pret.telefone = tel.numero
    pret.dddTelefone = tel.ddd
  }
  if (p.empresaMais2anos != null) pret.empresaMais2anos = simNao(p.empresaMais2anos)

  if (i.finalidade === 'C') {
    pret.cnae = p.cnae ?? undefined
    if (p.capitalInicial != null) pret.capital_inicial = valorPtBr(p.capitalInicial)
    if (p.capitalGiro != null) pret.capital_giro = valorPtBr(p.capitalGiro)
  }

  Object.assign(corpo.imovel as Record<string, unknown>, {
    endereco: i.endereco ?? undefined,
    numero: i.numero ?? undefined,
    complemento: i.complemento ?? undefined,
    bairro: i.bairro ?? undefined,
    cidade: i.cidade ?? undefined,
    estado: i.estado ?? undefined,
    condominio: i.condominio != null ? valorPtBr(i.condominio) : undefined,
    iptu: i.iptu != null ? valorPtBr(i.iptu) : undefined,
    gas: i.gas != null ? valorPtBr(i.gas) : undefined,
    energia: i.energia != null ? valorPtBr(i.energia) : undefined,
    agua: i.agua != null ? valorPtBr(i.agua) : undefined,
    tipo: tipoImovelParaMaximiza(i.tipo, i.finalidade) ?? undefined,
  })

  const sol = input.solidarios?.slice(0, 3) ?? []
  if (sol.length) {
    const pessoal: Record<string, unknown> = { numSolidarios: sol.length }
    sol.forEach((s, idx) => {
      pessoal[`solidario${idx + 1}`] = {
        nome: s.nome,
        cpf: s.cpf,
        dataNascimento: dataPtBr(s.dataNascimento),
      }
    })
    corpo.pessoal = pessoal
  }

  return corpo
}

/* ── Análise (entrada) ─────────────────────────────────────────────── */

interface ParecerBruto {
  seguradora?: string
  sigla?: string
  codigoStatus?: number
  descricaoStatus?: string
  codigoAnalise?: number | string
  limiteAprovado?: number
  statusBiometria?: number
  linkBiometria?: string
  msg?: string
}

/**
 * A sigla nem sempre volta — nas páginas 10-11 do PDF alguns itens só têm
 * `seguradora`. Quando faltar, derivamos do nome pra não perder o vínculo.
 */
function siglaDoParecer(p: ParecerBruto): string {
  if (p.sigla) return normalizarSigla(p.sigla)
  const nome = (p.seguradora ?? '').toLowerCase()
  if (nome.startsWith('porto')) return 'porto'
  return normalizarSigla(nome.slice(0, 3))
}

export function lerParecer(p: ParecerBruto): Parecer {
  return {
    seguradoraSigla: siglaDoParecer(p),
    seguradoraNome: p.seguradora ?? null,
    codigoStatus: p.codigoStatus ?? null,
    descricaoStatus: p.descricaoStatus ?? null,
    // Chega como número grande (909999999299): string evita perda de precisão.
    codigoAnalise: p.codigoAnalise != null ? String(p.codigoAnalise) : null,
    limiteAprovado: p.limiteAprovado ?? null,
    statusBiometria: p.statusBiometria ?? null,
    linkBiometria: p.linkBiometria ?? null,
    msg: p.msg?.trim() || null,
  }
}

export function lerResultadoAnalise(bruto: unknown): ResultadoAnalise {
  const o = (bruto ?? {}) as { id?: number; analises?: ParecerBruto[] }
  return {
    idExterno: Number(o.id ?? 0),
    // Só as integradas por API: a Junto aparece no painel deles mas é
    // atendimento manual, e um parecer dela aqui só confundiria.
    pareceres: (o.analises ?? []).map(lerParecer)
      .filter(p => seguradoraIntegrada(p.seguradoraSigla)),
  }
}

export function lerSeguradoras(bruto: unknown): Seguradora[] {
  const lista = Array.isArray(bruto) ? bruto : []
  return lista.map((s: Record<string, unknown>) => ({
    nome: String(s.seguradora ?? ''),
    sigla: normalizarSigla(String(s.sigla ?? '')),
    // Vem como "sim"/"não" — com acento, então comparamos pelo prefixo.
    aceitaAnaliseReduzida: String(s.analiseReduzida ?? '').toLowerCase().startsWith('s'),
  })).filter(s => s.sigla && seguradoraIntegrada(s.sigla))
}

export function lerArquivos(bruto: unknown, seguradoraSigla: string | null): ArquivoRecebido[] {
  const lista = Array.isArray(bruto) ? bruto : []
  return lista
    .map((a: Record<string, unknown>) => ({
      seguradoraSigla,
      codigoTipo: Number(a.codigo ?? a.codigoDescArquivo ?? 0),
      descricao: a.descricao ? String(a.descricao) : null,
      base64: String(a.base64 ?? ''),
    }))
    .filter(a => a.base64 && a.codigoTipo > 0)
}

/* ── Preços ────────────────────────────────────────────────────────── */

interface OpcaoBruta {
  entrada_pagto?: number
  forma_pagto_descricao?: string
  tipo_plano?: string
  qtd_parcelas?: number
  valor_parcela?: number
}

function lerOpcoes(plano: unknown): OpcaoPagamento[] {
  if (!plano || typeof plano !== 'object') return []
  const saida: OpcaoPagamento[] = []
  // O plano vem agrupado por forma de pagamento (cartao, fatura, boleto…);
  // achatamos, já que cada item já se identifica.
  for (const grupo of Object.values(plano as Record<string, unknown>)) {
    if (!Array.isArray(grupo)) continue
    for (const o of grupo as OpcaoBruta[]) {
      if (o?.valor_parcela == null) continue
      saida.push({
        formaPagamento: o.forma_pagto_descricao ?? '',
        tipoPlano: o.tipo_plano ?? '',
        qtdParcelas: o.qtd_parcelas ?? 1,
        valorParcela: o.valor_parcela,
        comEntrada: o.entrada_pagto === 1,
      })
    }
  }
  return saida
}

export function lerPlanos(bruto: unknown): PlanosPreco {
  const o = (bruto ?? {}) as Record<string, unknown>
  return {
    basico: lerOpcoes(o.plano_basico),
    completo: lerOpcoes(o.plano_completo),
    tradicional: lerOpcoes(o.plano_tradicional),
  }
}

/* ── Contratação ───────────────────────────────────────────────────── */

export function montarContratacao(input: ContratacaoInput): Record<string, unknown> {
  const { opcao: o, coberturas: c, proprietario: prop, imovel: im } = input

  return {
    id_analise: input.idAnaliseExterno,
    seguradora: input.seguradoraSigla,

    inicio_vigencia_apl: dataPtBr(input.inicioVigencia),
    fim_vigencia_apl: dataPtBr(input.fimVigencia),
    indice_reajuste: indiceReajusteParaMaximiza(input.indiceReajuste) ?? '1',

    // Encargos cobertos: valor em reais.
    condominio: c.condominio ?? 0,
    gas: c.gas ?? 0,
    iptu: c.iptu ?? 0,
    energia: c.energia ?? 0,
    agua: c.agua ?? 0,
    // Coberturas opcionais: flag 1/0. Mesmo objeto, convenção diferente.
    danos: umZero(c.danos),
    pintura_int: umZero(c.pinturaInterna),
    pintura_ext: umZero(c.pinturaExterna),
    multa: umZero(c.multa),

    qtd_parcelas: o.qtdParcelas,
    forma_pagto_descricao: o.formaPagamento,
    tipo_plano: o.tipoPlano,
    valor_parcela: o.valorParcela,
    premio_total: input.premioTotal,
    entrada_pagto: umZero(o.comEntrada),

    cep: im.cep,
    endereco: im.endereco,
    bairro: im.bairro,
    cidade: im.cidade,
    uf: im.uf,

    tipo_proprietario: prop.tipo,
    cpf_cnpj_proprietario: prop.cpfCnpj,
    rg_proprietario: prop.rg ?? '',
    nome_proprietario: prop.nome,
    data_proprietario: dataPtBr(prop.dataNascimento) ?? '',
    estado_civil_proprietario: estadoCivilParaMaximiza(prop.estadoCivil) ?? '0',
    obs_contratacao: input.observacoes ?? '',

    // Campos de cartão ficam de fora de propósito — ver ContratacaoInput.
  }
}
