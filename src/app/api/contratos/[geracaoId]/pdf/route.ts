import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratoDocument, type ContratoPDFData, type ContratoPDFClausula } from '@/lib/crm/contrato-pdf'
import { aplicarPlaceholders, limparTituloDuplicado, type DadosContrato } from '@/lib/contratos/montar'
import { rodarChecklist, bloqueiaGeracao, type DadosChecklist } from '@/lib/contratos/checklist'
import { validarTokenRevisao } from '@/lib/crm/revisao-token'
import { validarTokenAssinatura } from '@/lib/crm/assinatura-token'
import React from 'react'

// ── Helpers pra montar dados do PDF ─────────────────────────────────

type ContratoLite = {
  valor_aluguel?: number | null
  iptu_mensal?: number | null
  condominio_mensal?: number | null
  valor_seguro_fianca_mensal?: number | null
  caucao_valor?: number | null
  data_inicio?: string | null
  data_primeiro_aluguel?: string | null
  dia_vencimento?: number | null
  duracao_meses?: number | null
  garantia_tipo?: string | null
  aluguel_inclui_iptu?: boolean | null
  aluguel_inclui_condominio?: boolean | null
  aluguel_inclui_agua?: boolean | null
  aluguel_inclui_energia?: boolean | null
  aluguel_inclui_gas?: boolean | null
  aluguel_inclui_internet?: boolean | null
  qtd_chaves?: number | null
  qtd_controles?: number | null
  qtd_tags?: number | null
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function montarQuadroEntrada(c: ContratoLite & { data_inicio?: string | null; data_primeiro_aluguel?: string | null }) {
  const aluguel = c.valor_aluguel ?? 0
  const iptu = c.aluguel_inclui_iptu ? 0 : (c.iptu_mensal ?? 0)
  const condominio = c.aluguel_inclui_condominio ? 0 : (c.condominio_mensal ?? 0)
  const seguroFianca = c.valor_seguro_fianca_mensal ?? 0
  const caucao = c.caucao_valor ?? 0
  const itens: Array<{ descricao: string; base: string; valor: string; obs?: string }> = []

  // O primeiro aluguel é pago NO ATO (entrada) só se o 1º vencimento cai no
  // mesmo mês da entrada. Quando vence depois (ex: seguro fiança, 1 mês após),
  // ele NÃO entra na entrada — senão duplica a linha 1 da tabela dos 12 meses.
  const primeiroAluguelNoAto = (() => {
    if (!c.data_inicio || !c.data_primeiro_aluguel) return true
    const ini = new Date(c.data_inicio + 'T00:00:00')
    const pa = new Date(c.data_primeiro_aluguel + 'T00:00:00')
    return ini.getFullYear() === pa.getFullYear() && ini.getMonth() === pa.getMonth()
  })()

  // Caução é sempre da entrada (paga no ato)
  if (c.garantia_tipo === 'caucao' && caucao > 0) {
    const meses = aluguel > 0 ? Math.round(caucao / aluguel) : 3
    itens.push({
      descricao: 'Caução locatícia em dinheiro',
      base: `${meses} × ${fmtBRL(aluguel)}`,
      valor: fmtBRL(caucao),
    })
  }

  // Aluguel/IPTU/condomínio/seguro fiança só na entrada se pagos no ato
  if (primeiroAluguelNoAto) {
    if (aluguel > 0) itens.push({ descricao: 'Primeiro aluguel', base: 'Período inicial', valor: fmtBRL(aluguel) })
    if (iptu > 0) itens.push({ descricao: 'IPTU mensal', base: 'Período inicial', valor: fmtBRL(iptu) })
    if (condominio > 0) itens.push({ descricao: 'Condomínio mensal', base: 'Período inicial', valor: fmtBRL(condominio) })
    if (seguroFianca > 0 && c.garantia_tipo === 'seguro_fianca') {
      itens.push({ descricao: 'Seguro fiança mensal', base: 'Período inicial', valor: fmtBRL(seguroFianca) })
    }
  }

  if (itens.length === 0) return []

  const total =
    (c.garantia_tipo === 'caucao' ? caucao : 0) +
    (primeiroAluguelNoAto ? aluguel + iptu + condominio + (c.garantia_tipo === 'seguro_fianca' ? seguroFianca : 0) : 0)
  itens.push({ descricao: 'Total da entrada', base: '—', valor: fmtBRL(total) })
  return itens
}

function montarTabela12Meses(c: ContratoLite) {
  // PERÍODO da parcela: sempre a partir da DATA DE INÍCIO do contrato.
  //   Parcela 1 cobre data_inicio até dia anterior do próximo mês.
  // VENCIMENTO da parcela: a partir de data_primeiro_aluguel.
  //   Com seguro fiança/fiador, primeiro_aluguel costuma ser 1 mês após início
  //   (pagamento "postecipado" da 1ª parcela); sem garantia ou caução,
  //   primeiro_aluguel = início (pagamento antecipado).
  const dataInicio = c.data_inicio
  const dataPrimeiroVenc = c.data_primeiro_aluguel ?? c.data_inicio
  if (!dataInicio || !dataPrimeiroVenc || !c.valor_aluguel) {
    return { colunas: { iptu: false, condominio: false, seguro: false }, linhas: [] }
  }

  const aluguel = c.valor_aluguel
  const iptu = c.aluguel_inclui_iptu ? 0 : (c.iptu_mensal ?? 0)
  const condominio = c.aluguel_inclui_condominio ? 0 : (c.condominio_mensal ?? 0)
  const seguroFianca = (c.garantia_tipo === 'seguro_fianca') ? (c.valor_seguro_fianca_mensal ?? 0) : 0
  const total = aluguel + iptu + condominio + seguroFianca

  const colunas = {
    iptu: iptu > 0,
    condominio: condominio > 0,
    seguro: seguroFianca > 0,
  }

  const inicio = new Date(dataInicio + 'T00:00:00')
  const primeiroVenc = new Date(dataPrimeiroVenc + 'T00:00:00')
  const linhas = []

  for (let i = 0; i < 12; i++) {
    const periodoIni = new Date(inicio.getFullYear(), inicio.getMonth() + i, inicio.getDate())
    const periodoFim = new Date(inicio.getFullYear(), inicio.getMonth() + i + 1, inicio.getDate() - 1)
    const venc = new Date(primeiroVenc.getFullYear(), primeiroVenc.getMonth() + i, primeiroVenc.getDate())

    linhas.push({
      parcela: i + 1,
      periodo: `${periodoIni.toLocaleDateString('pt-BR')} a ${periodoFim.toLocaleDateString('pt-BR')}`,
      vencimento: venc.toLocaleDateString('pt-BR'),
      aluguel: fmtBRL(aluguel),
      iptu: colunas.iptu ? fmtBRL(iptu) : null,
      condominio: colunas.condominio ? fmtBRL(condominio) : null,
      seguro: colunas.seguro ? fmtBRL(seguroFianca) : null,
      total: fmtBRL(total),
    })
  }
  return { colunas, linhas }
}

function montarResumoCapa(
  c: ContratoLite & {
    data_inicio?: string | null
    data_termino?: string | null
    duracao_meses?: number | null
    seguro_fianca_seguradora?: string | null
    seguro_fianca_apolice?: string | null
    valor_seguro_fianca_mensal?: number | null
  },
  dados: {
    imovel?: {
      endereco_completo?: string | null
      endereco_resumido?: string | null
      endereco_numero?: string | null
      endereco_complemento?: string | null
      endereco_bairro?: string | null
      bairro_nome?: string | null
      tipo?: string | null
      descricao_real?: string | null
      descricao?: string | null
      area_construida_m2?: number | null
    } | null
  },
): {
  aluguel_str: string
  prazo_str: string
  inicio_str: string
  termino_str: string
  garantia_str: string
  seguro_fianca_str?: string
  imovel_endereco: string
  imovel_descricao: string
} {
  const im = dados.imovel
  let endereco = ''
  if (im?.endereco_completo) {
    endereco = [im.endereco_completo, im.endereco_numero ? `nº ${im.endereco_numero}` : null,
      im.endereco_complemento, im.endereco_bairro ?? im.bairro_nome].filter(Boolean).join(', ')
  } else if (im?.endereco_resumido) {
    endereco = `${im.endereco_resumido}${im.bairro_nome ? `, ${im.bairro_nome}` : ''}`
  }

  // Descrição curta: prioriza descricao_real, fallback descricao do anúncio (sem HTML)
  let descricao = im?.descricao_real ?? im?.descricao ?? ''
  descricao = descricao.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
  if (im?.area_construida_m2 && !descricao.includes('m²')) {
    descricao = descricao ? `${descricao} · ${im.area_construida_m2} m²` : `${im.area_construida_m2} m²`
  }

  // Garantia: label legível
  let garantia = '—'
  if (c.garantia_tipo === 'seguro_fianca') {
    garantia = `Seguro fiança${c.seguro_fianca_seguradora ? ` — ${c.seguro_fianca_seguradora}` : ''}${c.seguro_fianca_apolice ? ` · apólice ${c.seguro_fianca_apolice}` : ''}`
  } else if (c.garantia_tipo === 'fiador') garantia = 'Fiador'
  else if (c.garantia_tipo === 'caucao') garantia = c.caucao_valor ? `Caução · ${fmtBRL(c.caucao_valor)}` : 'Caução'
  else if (c.garantia_tipo === 'sem_garantia') garantia = 'Sem garantia'

  // Datas e prazo
  const inicio = fmtData(c.data_inicio ?? null)
  let termino = '—'
  if (c.data_termino) termino = fmtData(c.data_termino)
  else if (c.data_inicio && c.duracao_meses) {
    const ini = new Date(c.data_inicio + 'T00:00:00')
    const fim = new Date(ini.getFullYear(), ini.getMonth() + c.duracao_meses, ini.getDate() - 1)
    termino = fim.toLocaleDateString('pt-BR')
  }

  const sfMensal = c.valor_seguro_fianca_mensal ?? 0
  const seguroFiancaStr = (c.garantia_tipo === 'seguro_fianca' && sfMensal > 0)
    ? `${fmtBRL(sfMensal)} / mês`
    : undefined

  return {
    aluguel_str: `${fmtBRL(c.valor_aluguel ?? 0)} / mês`,
    prazo_str: c.duracao_meses ? `${c.duracao_meses} meses` : '—',
    inicio_str: inicio,
    termino_str: termino,
    garantia_str: garantia,
    seguro_fianca_str: seguroFiancaStr,
    imovel_endereco: endereco,
    imovel_descricao: descricao,
  }
}

function montarTermoChaves(
  c: ContratoLite & { data_inicio?: string | null },
  dados: {
    imovel?: {
      endereco_completo?: string | null
      endereco_resumido?: string | null
      endereco_numero?: string | null
      endereco_complemento?: string | null
      endereco_bairro?: string | null
      bairro_nome?: string | null
    } | null
  },
  recebedores: Array<{ nome: string; cpf: string | null }>,
): { endereco_imovel: string; data_entrega: string; qtd_chaves: number; qtd_controles: number; qtd_tags: number; recebedores: Array<{ nome: string; cpf: string | null }> } {
  const im = dados.imovel
  // Mesma lógica do IMOVEL_ENDERECO em montar.ts: monta endereço completo
  // com logradouro + número + complemento + bairro.
  let endereco = '[ENDEREÇO DO IMÓVEL]'
  if (im?.endereco_completo) {
    const partes = [
      im.endereco_completo,
      im.endereco_numero ? `nº ${im.endereco_numero}` : null,
      im.endereco_complemento,
      im.endereco_bairro ?? im.bairro_nome,
    ].filter(Boolean)
    endereco = partes.join(', ')
  } else if (im?.endereco_resumido) {
    endereco = `${im.endereco_resumido}${im.bairro_nome ? `, ${im.bairro_nome}` : ''}`
  }
  return {
    endereco_imovel: endereco,
    data_entrega: fmtData(c.data_inicio ?? null),
    qtd_chaves: c.qtd_chaves ?? 0,
    qtd_controles: c.qtd_controles ?? 0,
    qtd_tags: c.qtd_tags ?? 0,
    recebedores,
  }
}

/**
 * Faz merge do PDF principal com os PDFs anexados (documentos das partes).
 * Imagens (jpg/png) também são suportadas — são embarcadas como página única.
 */
async function mergeAnexos(
  principal: Uint8Array,
  anexos: Array<{ buffer: Uint8Array; mime: string }>
): Promise<Uint8Array> {
  if (anexos.length === 0) return principal

  const pdfFinal = await PDFDocument.load(principal)

  for (const anexo of anexos) {
    try {
      if (anexo.mime === 'application/pdf') {
        const src = await PDFDocument.load(anexo.buffer, { ignoreEncryption: true })
        const paginas = await pdfFinal.copyPages(src, src.getPageIndices())
        paginas.forEach(p => pdfFinal.addPage(p))
      } else if (anexo.mime === 'image/jpeg' || anexo.mime === 'image/jpg') {
        const img = await pdfFinal.embedJpg(anexo.buffer)
        const pag = pdfFinal.addPage([595.28, 841.89])  // A4
        const escala = Math.min(495 / img.width, 750 / img.height)
        pag.drawImage(img, {
          x: 50, y: 50,
          width: img.width * escala,
          height: img.height * escala,
        })
      } else if (anexo.mime === 'image/png') {
        const img = await pdfFinal.embedPng(anexo.buffer)
        const pag = pdfFinal.addPage([595.28, 841.89])
        const escala = Math.min(495 / img.width, 750 / img.height)
        pag.drawImage(img, {
          x: 50, y: 50,
          width: img.width * escala,
          height: img.height * escala,
        })
      }
    } catch (e) {
      console.error('[contrato-pdf] falha ao anexar:', e)
      // continua com os outros anexos
    }
  }

  return pdfFinal.save()
}

/**
 * Carimba paginação no rodapé de cada página do PDF final, via pdf-lib
 * (depois do render — evita o bug "unsupported number" do react-pdf com
 * Text fixed). Texto centralizado: "Contrato XYZ · AluguelCuiaba.com.br · Página i/n".
 */
async function carimbarPaginacao(pdfBytes: Uint8Array, codigo: string): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(pdfBytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const paginas = pdf.getPages()
    const total = paginas.length
    paginas.forEach((page, i) => {
      const { width } = page.getSize()
      const texto = `Contrato ${codigo}  ·  AluguelCuiaba.com.br  ·  Página ${i + 1} de ${total}`
      const size = 7
      const larguraTexto = font.widthOfTextAtSize(texto, size)
      page.drawText(texto, {
        x: (width - larguraTexto) / 2,
        y: 22,
        size,
        font,
        color: rgb(0.6, 0.6, 0.64),
      })
    })
    return await pdf.save()
  } catch (e) {
    // Se algo falhar, retorna o PDF sem paginação (não bloqueia a geração)
    console.error('[contrato-pdf] falha ao carimbar paginação:', e)
    return pdfBytes
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60

function fmtCpf(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

function fmtCnpj(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ geracaoId: string }> }
) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ?force=1 ignora os bloqueios do checklist (corretor decidiu gerar mesmo assim)
  const forcar = new URL(request.url).searchParams.get('force') === '1'

  const { geracaoId } = await params
  const admin = createAdminClient()

  // Autoriza por login OU por token de revisão (?rt=), pro cliente ver sem conta.
  let ownerId: string | null = user?.id ?? null
  if (!ownerId) {
    const url = new URL(request.url)
    const rt = url.searchParams.get('rt')
    const st = url.searchParams.get('st')
    if (rt) ownerId = await validarTokenRevisao(admin, rt, 'locacao', geracaoId)
    else if (st) ownerId = await validarTokenAssinatura(admin, st, 'locacao', geracaoId)
  }
  if (!ownerId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // 1. Carrega a geração
  const { data: geracao } = await admin
    .from('contrato_geracoes')
    .select('id, user_id, contrato_id, tipo_seguro_incendio, saida_sem_multa_12m, clausulas, clausula_ids, testemunha_ids, clausulas_seguradora_texto, anexo_documento_ids, incluir_capa')
    .eq('id', geracaoId)
    .maybeSingle()

  if (!geracao || geracao.user_id !== ownerId) {
    return NextResponse.json({ error: 'Geração não encontrada' }, { status: 404 })
  }

  // Assinaturas desenhadas (plataforma) já registradas → sobrepõe na linha de cada parte
  let assinaturasPartes: Array<{ papel: string; imagem: string }> = []
  const { data: procAssin } = await admin
    .from('contrato_assinaturas')
    .select('id')
    .eq('tipo_contrato', 'locacao').eq('contrato_id', geracaoId).neq('status', 'cancelado')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (procAssin) {
    const { data: sigs } = await admin
      .from('contrato_assinatura_signatarios')
      .select('papel, assinatura_b64').eq('assinatura_id', procAssin.id).eq('status', 'assinado')
    assinaturasPartes = (sigs ?? [])
      .filter(s => s.assinatura_b64)
      .map(s => ({ papel: s.papel ?? '', imagem: s.assinatura_b64 as string }))
  }

  // 2. Carrega contrato + pessoas + imóvel
  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select(`
      id, codigo, valor_aluguel, iptu_mensal, condominio_mensal,
      data_inicio, data_primeiro_aluguel, data_termino, duracao_meses, dia_vencimento,
      garantia_tipo, caucao_valor,
      seguro_fianca_seguradora, seguro_fianca_apolice,
      valor_seguro_fianca_mensal, valor_seguro_incendio_anual,
      taxa_admin_tipo, taxa_admin_valor,
      tipo_atuacao, intermediador_assina, tipo_mobilia, tem_inventario_bens, aceita_pet, finalidade, conjuge_inquilino_papel,
      aluguel_inclui_iptu, aluguel_inclui_condominio, aluguel_inclui_agua,
      aluguel_inclui_energia, aluguel_inclui_gas, aluguel_inclui_internet,
      qtd_chaves, qtd_controles, qtd_tags,
      imovel:imoveis(
        tipo, endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
        endereco_cep, descricao, descricao_real,
        matricula_cartorio, inscricao_municipal, uc_energia, matricula_agua,
        area_construida_m2, area_terreno_m2,
        cartorio_registro, livro_folha_matricula,
        hidrometro_numero, hidrometro_leitura_inicial,
        medidor_energia_numero, medidor_energia_leitura_inicial,
        bairro:bairros(nome)
      ),
      proprietario:pessoas!proprietario_id(
        nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
        nacionalidade, estado_civil, profissao, genero,
        endereco_logradouro, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
      ),
      inquilino:pessoas!inquilino_id(
        nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
        nacionalidade, estado_civil, regime_bens, profissao, genero,
        data_nascimento, naturalidade, nome_pai, nome_mae,
        endereco_logradouro, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
        conjuge_nome, conjuge_cpf, conjuge_genero, conjuge_rg, conjuge_data_nascimento,
        conjuge_profissao, conjuge_nacionalidade,
        conjuge_naturalidade, conjuge_nome_pai, conjuge_nome_mae,
        conjuge_endereco_logradouro, conjuge_endereco_numero,
        conjuge_endereco_bairro, conjuge_endereco_cidade,
        conjuge_endereco_estado, conjuge_endereco_cep
      ),
      fiador:pessoas!fiador_id(
        nome, cpf_cnpj, rg, genero,
        endereco_logradouro, endereco_numero,
        endereco_cidade, endereco_estado
      )
    `)
    .eq('id', geracao.contrato_id)
    .single()

  if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  // 2b. Carrega moradores adicionais (co-locatários solidários, moradores, sócios signatários)
  const { data: moradoresRaw } = await admin
    .from('contratos_moradores')
    .select(`
      papel, mora_no_imovel, assina_contrato,
      pessoa:pessoas(nome, cpf_cnpj)
    `)
    .eq('contrato_id', geracao.contrato_id)

  // 2c. Carrega testemunhas selecionadas
  const testemunhaIds = (geracao.testemunha_ids ?? []) as string[]
  const { data: testemunhasRaw } = testemunhaIds.length > 0
    ? await admin
        .from('pessoas')
        .select('id, nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf')
        .in('id', testemunhaIds)
        .eq('user_id', ownerId)
    : { data: [] }

  // 3. Carrega perfil do usuário (administradora)
  const { data: perfil } = await admin
    .from('perfis')
    .select(`
      nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
      endereco_logradouro, endereco_numero, endereco_bairro,
      endereco_cidade, endereco_uf, endereco_cep
    `)
    .eq('id', ownerId)
    .maybeSingle()

  // 4. Cláusulas: usa o SNAPSHOT da geração (cópia própria deste contrato).
  //    Gerações antigas (antes da v64) caem no fallback via clausula_ids.
  const snapshot = (geracao.clausulas ?? []) as Array<{ titulo: string; corpo: string }>
  let clausulasOrdenadas: Array<{ titulo: string; corpo: string }>
  if (snapshot.length > 0) {
    clausulasOrdenadas = snapshot
  } else {
    const ids = (geracao.clausula_ids ?? []) as string[]
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhuma cláusula selecionada na geração' }, { status: 400 })
    }
    const { data: clausulasRaw } = await admin
      .from('contrato_clausulas')
      .select('id, titulo, corpo')
      .in('id', ids)
    const mapaClausulas = new Map((clausulasRaw ?? []).map(c => [c.id, c]))
    clausulasOrdenadas = ids
      .map(id => mapaClausulas.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
  }

  // 5. Monta os dados pra placeholders
  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const fia = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
  const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
  const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

  const dadosContrato: DadosContrato = {
    locador: prop,
    locatario: inq,
    fiador: fia,
    admin: perfil ? {
      nome: perfil.nome,
      razao_social: perfil.razao_social,
      cnpj: perfil.cnpj,
      creci: perfil.creci,
      creci_juridico: perfil.creci_juridico,
      endereco_logradouro: perfil.endereco_logradouro,
      endereco_numero: perfil.endereco_numero,
      endereco_bairro: perfil.endereco_bairro,
      endereco_cidade: perfil.endereco_cidade,
      endereco_uf: perfil.endereco_uf,
      endereco_cep: perfil.endereco_cep,
    } : null,
    imovel: im ? {
      ...im,
      bairro_nome: bairro?.nome ?? null,
    } : null,
    contrato: {
      codigo: contrato.codigo,
      valor_aluguel: contrato.valor_aluguel,
      iptu_mensal: contrato.iptu_mensal,
      condominio_mensal: contrato.condominio_mensal,
      data_inicio: contrato.data_inicio,
      data_termino: contrato.data_termino,
      duracao_meses: contrato.duracao_meses,
      dia_vencimento: contrato.dia_vencimento,
      caucao_valor: contrato.caucao_valor,
      seguro_fianca_seguradora: contrato.seguro_fianca_seguradora,
      seguro_fianca_apolice: contrato.seguro_fianca_apolice,
      valor_seguro_fianca_mensal: contrato.valor_seguro_fianca_mensal,
      valor_seguro_incendio_anual: contrato.valor_seguro_incendio_anual,
      aluguel_inclui_iptu: contrato.aluguel_inclui_iptu ?? false,
      aluguel_inclui_condominio: contrato.aluguel_inclui_condominio ?? false,
      aluguel_inclui_agua: contrato.aluguel_inclui_agua ?? false,
      aluguel_inclui_energia: contrato.aluguel_inclui_energia ?? false,
      aluguel_inclui_gas: contrato.aluguel_inclui_gas ?? false,
      aluguel_inclui_internet: contrato.aluguel_inclui_internet ?? false,
      // Tipo do seguro incêndio vem da GERAÇÃO (não do contrato),
      // mas afeta cálculo de TOTAL_BOLETO / SEGURO_INCENDIO_VALOR.
      tipo_seguro_incendio: geracao.tipo_seguro_incendio ?? 'dispensado',
    },
  }

  // 6. Aplica placeholders em cada cláusula + remove título duplicado no corpo
  //    (acontece quando user/ChatGPT cola o título em maiúsculas no início do texto)
  const clausulas: ContratoPDFClausula[] = clausulasOrdenadas.map((c, idx) => ({
    numero: idx + 1,
    titulo: c.titulo,
    corpo: aplicarPlaceholders(limparTituloDuplicado(c.titulo, c.corpo), dadosContrato),
  }))

  // 6b. Cláusula sintética de interveniente anuente — quando há responsável
  //     pelo seguro fiança (terceiro). Explica no CORPO que ele não tem posse
  //     nem é morador. Inserida logo após a cláusula de garantia.
  {
    const respSeguro = (moradoresRaw ?? [])
      .filter((m: { papel: string }) => m.papel === 'responsavel_seguro')
      .map((m: { pessoa: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null }) => {
        const p = Array.isArray(m.pessoa) ? m.pessoa[0] : m.pessoa
        return p?.nome ? { nome: p.nome, cpf: fmtCpf(p.cpf_cnpj) } : null
      })
      .filter((x): x is { nome: string; cpf: string | null } => x !== null)

    if (respSeguro.length > 0) {
      const nomes = respSeguro.map(r => `${r.nome}${r.cpf ? `, CPF nº ${r.cpf}` : ''}`).join('; ')
      const plural = respSeguro.length > 1
      const corpoInterveniente =
        `${nomes}, participa${plural ? 'm' : ''} do presente contrato na qualidade de RESPONSÁVEL PELO SEGURO FIANÇA / INTERVENIENTE ANUENTE, para fins de composição cadastral, aprovação, contratação, manutenção, anuência e/ou pagamento do prêmio do seguro fiança locatício, conforme proposta, apólice e condições da seguradora.\n\n` +
        `Parágrafo primeiro. O comparecimento neste instrumento não lhe confere posse direta do imóvel, não o caracteriza como morador e não altera a ocupação residencial indicada neste contrato, salvo se expressamente cadastrado também como LOCATÁRIO.\n\n` +
        `Parágrafo segundo. O prêmio do seguro fiança poderá ser pago pelo responsável aqui qualificado, pelo LOCATÁRIO ou por terceiro indicado, conforme a proposta/apólice e a forma de cobrança adotada pela seguradora ou administradora, permanecendo os LOCATÁRIOS responsáveis pelas obrigações locatícias principais.\n\n` +
        `Parágrafo terceiro. Caso a seguradora exija a assinatura do cônjuge do responsável pelo seguro fiança, este assinará como CÔNJUGE DO RESPONSÁVEL PELO SEGURO FIANÇA / INTERVENIENTE ANUENTE, sem figurar como locatário ou morador, salvo indicação expressa em contrário.`

      const novaClausula: ContratoPDFClausula = {
        numero: 0,
        titulo: 'Do responsável pelo seguro fiança / interveniente anuente',
        corpo: corpoInterveniente,
      }
      // Insere após a cláusula de garantia (título com "garantia" ou "seguro-fiança")
      const idxGarantia = clausulas.findIndex(c => /garantia|seguro[\s-]*fian/i.test(c.titulo))
      if (idxGarantia >= 0) clausulas.splice(idxGarantia + 1, 0, novaClausula)
      else clausulas.push(novaClausula)
      clausulas.forEach((c, i) => { c.numero = i + 1 })
    }
  }

  // 6c. Qualificação do cônjuge do locatário no CORPO (após "Das partes"),
  //     quando ele participa (solidário ou anuente). Resolve a inconsistência
  //     de aparecer na capa/assinatura mas não no corpo.
  {
    const conjugePapel = (contrato.conjuge_inquilino_papel ?? 'solidario') as 'solidario' | 'anuente' | 'nao_participa'
    if (inq?.conjuge_nome && conjugePapel !== 'nao_participa') {
      const c = inq
      const quali = [
        c.conjuge_nacionalidade,
        c.conjuge_profissao,
        c.conjuge_rg ? `portador(a) do RG ${c.conjuge_rg}` : null,
        c.conjuge_cpf ? `CPF nº ${fmtCpf(c.conjuge_cpf)}` : null,
      ].filter(Boolean).join(', ')

      const corpoConjuge = conjugePapel === 'solidario'
        ? `${c.conjuge_nome}${quali ? `, ${quali}` : ''}, cônjuge do LOCATÁRIO, participa do presente contrato na qualidade de LOCATÁRIA(O) SOLIDÁRIA(O), passando a integrar o polo locatário para todos os fins. A LOCATÁRIA(O) SOLIDÁRIA(O) também ocupará o imóvel e responderá solidariamente por todas as obrigações locatícias previstas neste contrato — aluguel, encargos, conservação, multas, danos e devolução —, podendo receber as chaves em conjunto com o LOCATÁRIO.`
        : `${c.conjuge_nome}${quali ? `, ${quali}` : ''}, cônjuge do LOCATÁRIO, participa do presente contrato na qualidade de CÔNJUGE ANUENTE / OCUPANTE AUTORIZADA, residindo no imóvel e assinando para ciência e anuência das condições pactuadas, sem assumir responsabilidade solidária pelas obrigações locatícias, salvo disposição expressa em contrário.`

      const novaClausulaConjuge: ContratoPDFClausula = {
        numero: 0,
        titulo: conjugePapel === 'solidario'
          ? 'Da locatária(o) solidária(o) / cônjuge do locatário'
          : 'Do cônjuge anuente / ocupante autorizada',
        corpo: corpoConjuge,
      }
      // Insere logo após "Das partes"
      const idxPartes = clausulas.findIndex(c2 => /das partes/i.test(c2.titulo))
      if (idxPartes >= 0) clausulas.splice(idxPartes + 1, 0, novaClausulaConjuge)
      else clausulas.unshift(novaClausulaConjuge)
      clausulas.forEach((c2, i) => { c2.numero = i + 1 })
    }
  }

  // 6d. Inventário de bens (imóvel mobiliado)
  const { data: inventarioRaw } = await admin
    .from('contrato_inventario_itens')
    .select('descricao, quantidade, marca_modelo, estado, observacao')
    .eq('contrato_id', geracao.contrato_id)
    .order('ordem', { ascending: true })

  // 7. Endereço da admin
  const cepFmt = perfil?.endereco_cep
    ? perfil.endereco_cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')
    : null
  const adminEnderecoPartes = [
    perfil?.endereco_logradouro,
    perfil?.endereco_numero ? `nº ${perfil.endereco_numero}` : null,
    perfil?.endereco_bairro,
    perfil?.endereco_cidade && perfil?.endereco_uf
      ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
      : null,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean)

  // Inferência: há administração imobiliária quando taxa_admin_valor > 0
  const temAdministracao = (contrato.taxa_admin_valor ?? 0) > 0

  // Mapeia papel técnico pra texto humano na folha de assinatura
  const labelPapel: Record<string, string> = {
    inquilino_solidario: 'Co-locatário solidário',
    morador: 'Morador',
    socio_signatario: 'Sócio signatário',
    responsavel_seguro: 'Responsável pelo seguro fiança / interveniente anuente',
    conjuge_responsavel_seguro: 'Cônjuge do responsável pelo seguro',
    ocupante_autorizado: 'Ocupante autorizado',
    caucionante: 'Caucionante / interveniente anuente',
  }
  type MoradorRel = {
    papel: string
    mora_no_imovel: boolean
    assina_contrato?: boolean | null
    pessoa: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
  }
  const moradoresAdicionais = (moradoresRaw ?? [])
    .map((m: MoradorRel) => {
      const p = Array.isArray(m.pessoa) ? m.pessoa[0] : m.pessoa
      if (!p?.nome) return null
      // Quem aparece no bloco de assinatura: quem assina o contrato.
      // Ocupante autorizado e morador comum que NÃO mora ficam de fora.
      const assina = m.assina_contrato ?? (m.papel !== 'ocupante_autorizado')
      if (m.papel === 'morador' && !m.mora_no_imovel) return null
      if (m.papel === 'ocupante_autorizado') return null  // ocupante não assina
      if (!assina) return null
      return {
        nome: p.nome,
        cpf: fmtCpf(p.cpf_cnpj),
        papel: labelPapel[m.papel] ?? m.papel,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Recebedores das chaves: locatário principal + quem MORA no imóvel
  // (co-locatário solidário, ocupante autorizado, morador). Responsável pelo
  // seguro / caucionante / cônjuge do responsável NÃO recebem chaves.
  const recebedoresChaves: Array<{ nome: string; cpf: string | null }> = []
  if (inq?.nome) recebedoresChaves.push({ nome: inq.nome, cpf: fmtCpf(inq.cpf_cnpj) })
  // Cônjuge solidário também recebe as chaves (mora + assume)
  if (inq?.conjuge_nome && (contrato.conjuge_inquilino_papel ?? 'solidario') === 'solidario') {
    recebedoresChaves.push({ nome: inq.conjuge_nome, cpf: fmtCpf(inq.conjuge_cpf) })
  }
  for (const m of (moradoresRaw ?? []) as MoradorRel[]) {
    const p = Array.isArray(m.pessoa) ? m.pessoa[0] : m.pessoa
    if (!p?.nome) continue
    const recebeChaves =
      (m.papel === 'inquilino_solidario' || m.papel === 'ocupante_autorizado' || m.papel === 'morador')
      && m.mora_no_imovel
    if (recebeChaves) recebedoresChaves.push({ nome: p.nome, cpf: fmtCpf(p.cpf_cnpj) })
  }

  // 8. Monta o data final do PDF
  const pdfData: ContratoPDFData = {
    codigo: contrato.codigo,
    data_assinatura: new Date().toISOString().slice(0, 10),
    anunciante_nome: perfil?.nome ?? 'AluguelCuiabá',
    anunciante_razao_social: perfil?.razao_social ?? null,
    anunciante_cnpj: fmtCnpj(perfil?.cnpj ?? null),
    anunciante_creci: perfil?.creci ?? null,
    anunciante_creci_juridico: perfil?.creci_juridico ?? null,
    anunciante_logo_url: perfil?.recibo_logo_url ?? null,
    anunciante_endereco: adminEnderecoPartes.length ? adminEnderecoPartes.join(', ') : null,
    anunciante_cidade_uf: perfil?.endereco_cidade && perfil?.endereco_uf
      ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
      : null,
    locador_nome: prop?.nome ?? '[PREENCHER]',
    locador_cpf: fmtCpf(prop?.cpf_cnpj ?? null),
    assinaturas_partes: assinaturasPartes,
    tem_administracao: temAdministracao,
    admin_responsavel_nome: perfil?.nome ?? null,
    admin_responsavel_creci: perfil?.creci ?? null,
    incluir_capa: geracao.incluir_capa ?? true,
    resumo_capa: montarResumoCapa(contrato, dadosContrato),
    tipo_atuacao: (contrato.tipo_atuacao ?? 'administracao') as 'administracao' | 'intermediacao' | 'direto',
    intermediador_assina: contrato.intermediador_assina ?? false,
    finalidade: (contrato.finalidade ?? 'residencial') as 'residencial' | 'comercial' | 'misto',
    locatario_nome: inq?.nome ?? '[PREENCHER]',
    locatario_cpf: fmtCpf(inq?.cpf_cnpj ?? null),
    conjuge_nome: inq?.conjuge_nome ?? null,
    conjuge_cpf: fmtCpf(inq?.conjuge_cpf ?? null),
    conjuge_papel: (contrato.conjuge_inquilino_papel ?? 'solidario') as 'solidario' | 'anuente' | 'nao_participa',
    moradores_adicionais: moradoresAdicionais,
    fiador_nome: fia?.nome ?? null,
    fiador_cpf: fmtCpf(fia?.cpf_cnpj ?? null),
    // Mantém a ordem em que o usuário escolheu
    testemunhas: testemunhaIds
      .map(id => (testemunhasRaw ?? []).find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map(t => ({
        nome: t.nome,
        cpf: fmtCpf(t.cpf_cnpj),
        rg: t.rg ? [t.rg, t.rg_orgao_emissor, t.rg_uf].filter(Boolean).join(' ') : null,
      })),
    clausulas_seguradora_texto: geracao.clausulas_seguradora_texto ?? null,
    clausulas,
    inventario: (inventarioRaw ?? []).map(it => ({
      descricao: it.descricao,
      quantidade: it.quantidade,
      marca_modelo: it.marca_modelo,
      estado: it.estado,
      observacao: it.observacao,
    })),
    quadro_entrada: montarQuadroEntrada(contrato),
    tabela_12_meses: montarTabela12Meses(contrato),
    termo_chaves: montarTermoChaves(contrato, dadosContrato, recebedoresChaves),
  }

  // 8b. Validação pré-PDF: bloqueia geração se houver inconsistência crítica
  //     (a menos que ?force=1). Reusa o mesmo checklist do editor.
  if (!forcar) {
    const dadosCheck: DadosChecklist = {
      tipo_atuacao: (contrato.tipo_atuacao ?? 'administracao') as DadosChecklist['tipo_atuacao'],
      admin_cnpj: perfil?.cnpj ?? null,
      admin_creci_juridico: perfil?.creci_juridico ?? null,
      tipo_mobilia: (contrato.tipo_mobilia ?? 'sem') as DadosChecklist['tipo_mobilia'],
      tem_inventario_bens: contrato.tem_inventario_bens ?? false,
      locador_nome: prop?.nome ?? null,
      locador_cpf: prop?.cpf_cnpj ?? null,
      locatario_nome: inq?.nome ?? null,
      locatario_cpf: inq?.cpf_cnpj ?? null,
      imovel_endereco: pdfData.resumo_capa?.imovel_endereco || null,
      garantia_tipo: contrato.garantia_tipo ?? null,
      fiador_nome: fia?.nome ?? null,
      seguro_fianca_seguradora: contrato.seguro_fianca_seguradora ?? null,
      seguro_fianca_apolice: contrato.seguro_fianca_apolice ?? null,
      caucao_valor: contrato.caucao_valor ?? null,
      data_inicio: contrato.data_inicio ?? null,
      data_termino: contrato.data_termino ?? null,
      duracao_meses: contrato.duracao_meses ?? null,
      valor_aluguel: contrato.valor_aluguel ?? null,
      dia_vencimento: contrato.dia_vencimento ?? null,
    }
    const itens = rodarChecklist(dadosCheck)
    if (bloqueiaGeracao(itens)) {
      const bloqueios = itens.filter(i => i.severidade === 'block')
      return NextResponse.json({
        error: 'CONTRATO NÃO GERADO: há inconsistências que precisam ser corrigidas antes de emitir.',
        bloqueios: bloqueios.map(b => ({ rotulo: b.rotulo, mensagem: b.mensagem ?? b.rotulo })),
      }, { status: 422 })
    }
  }

  // 9. Renderiza o contrato principal
  const element = React.createElement(ContratoDocument, { data: pdfData }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  // 10. Anexa PDFs dos documentos selecionados (Fase D)
  const anexoIds = (geracao.anexo_documento_ids ?? []) as string[]
  let finalBytes: Uint8Array = new Uint8Array(buffer)
  if (anexoIds.length > 0) {
    const { data: docs } = await admin
      .from('pessoas_documentos')
      .select('id, arquivo_path, mime_type')
      .in('id', anexoIds)
      .eq('user_id', ownerId)

    if (docs && docs.length > 0) {
      // baixa cada arquivo do storage
      const anexosBuffers: Array<{ buffer: Uint8Array; mime: string }> = []
      // mantém a ordem do array de IDs (não a ordem que vem do select)
      const mapaDoc = new Map(docs.map(d => [d.id, d]))
      for (const id of anexoIds) {
        const d = mapaDoc.get(id)
        if (!d) continue
        const { data: blob } = await admin.storage
          .from('documentos-pessoas')
          .download(d.arquivo_path)
        if (!blob) continue
        const ab = await blob.arrayBuffer()
        anexosBuffers.push({ buffer: new Uint8Array(ab), mime: d.mime_type ?? 'application/pdf' })
      }
      finalBytes = await mergeAnexos(finalBytes, anexosBuffers)
    }
  }

  // 11. Carimba paginação no rodapé de todas as páginas
  finalBytes = await carimbarPaginacao(finalBytes, contrato.codigo)

  const filename = `contrato-${contrato.codigo}.pdf`
  return new Response(finalBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[contrato-pdf] erro ao gerar:', msg, stack)
    return NextResponse.json(
      {
        error: 'Falha ao gerar PDF',
        detail: msg,
        stack: stack ? stack.split('\n').slice(0, 20).join('\n') : null,
      },
      { status: 500 }
    )
  }
}
