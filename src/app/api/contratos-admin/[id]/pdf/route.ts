import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratoDocument, type ContratoPDFData, type ContratoPDFClausula } from '@/lib/crm/contrato-pdf'
import { aplicarPlaceholders, type DadosContrato } from '@/lib/contratos/montar'
import { validarTokenRevisao } from '@/lib/crm/revisao-token'
import { validarTokenAssinatura } from '@/lib/crm/assinatura-token'
import React from 'react'

async function mergeAnexos(
  principal: Uint8Array,
  anexos: Array<{ buffer: Uint8Array; mime: string }>
): Promise<Uint8Array> {
  if (anexos.length === 0) return principal
  const pdfFinal = await PDFDocument.load(principal)

  for (const a of anexos) {
    try {
      if (a.mime === 'application/pdf') {
        const src = await PDFDocument.load(a.buffer, { ignoreEncryption: true })
        const pgs = await pdfFinal.copyPages(src, src.getPageIndices())
        pgs.forEach(p => pdfFinal.addPage(p))
      } else if (a.mime === 'image/jpeg' || a.mime === 'image/jpg') {
        const img = await pdfFinal.embedJpg(a.buffer)
        const pag = pdfFinal.addPage([595.28, 841.89])
        const esc = Math.min(495 / img.width, 750 / img.height)
        pag.drawImage(img, { x: 50, y: 50, width: img.width * esc, height: img.height * esc })
      } else if (a.mime === 'image/png') {
        const img = await pdfFinal.embedPng(a.buffer)
        const pag = pdfFinal.addPage([595.28, 841.89])
        const esc = Math.min(495 / img.width, 750 / img.height)
        pag.drawImage(img, { x: 50, y: 50, width: img.width * esc, height: img.height * esc })
      }
    } catch (e) {
      console.error('[contrato-admin-pdf] falha ao anexar:', e)
    }
  }
  return pdfFinal.save()
}

/** Carimba paginação no rodapé de cada página (pós-render, via pdf-lib). */
async function carimbarPaginacao(pdfBytes: Uint8Array, codigo: string): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(pdfBytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const paginas = pdf.getPages()
    const total = paginas.length
    paginas.forEach((page, i) => {
      const { width } = page.getSize()
      const texto = `Contrato de Administração ${codigo}  ·  AluguelCuiaba.com.br  ·  Página ${i + 1} de ${total}`
      const size = 7
      const larguraTexto = font.widthOfTextAtSize(texto, size)
      page.drawText(texto, { x: (width - larguraTexto) / 2, y: 22, size, font, color: rgb(0.6, 0.6, 0.64) })
    })
    return await pdf.save()
  } catch (e) {
    console.error('[contrato-admin-pdf] falha ao carimbar paginação:', e)
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

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtBRLNum(v: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatPct(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')
  return `${s}%`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { id } = await params
    const admin = createAdminClient()

    // Autoriza por login OU por token de revisão (?rt=), pro cliente ver sem conta.
    // viaRevisao = aberto pelo link de revisão → força os destaques de modificação.
    let ownerId: string | null = user?.id ?? null
    let viaRevisao = false
    if (!ownerId) {
      const url = new URL(request.url)
      const rt = url.searchParams.get('rt')
      const st = url.searchParams.get('st')
      if (rt) {
        ownerId = await validarTokenRevisao(admin, rt, 'administracao', id)
        viaRevisao = !!ownerId
      } else if (st) {
        ownerId = await validarTokenAssinatura(admin, st, 'administracao', id)
      }
    }
    if (!ownerId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // 1. Carrega contrato de administração + proprietário + imóvel
    const { data: c } = await admin
      .from('contratos_administracao')
      .select(`
        *,
        proprietario:pessoas!proprietario_id(
          nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
          nacionalidade, estado_civil, profissao, genero,
          endereco_logradouro, endereco_numero, endereco_complemento,
          endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
        ),
        proprietario_representante:pessoas!proprietario_representante_id(nome, cpf_cnpj),
        imovel:imoveis(
          tipo, endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
          endereco_cep, descricao, descricao_real,
          matricula_cartorio, inscricao_municipal, uc_energia, matricula_agua,
          area_construida_m2, area_terreno_m2,
          cartorio_registro, livro_folha_matricula,
          bairro:bairros(nome)
        )
      `)
      .eq('id', id)
      .single()

    if (!c) return NextResponse.json({ error: 'Contrato de administração não encontrado' }, { status: 404 })
    if (c.user_id !== ownerId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // Assinaturas desenhadas (plataforma) já registradas → sobrepõe na linha de cada parte
    let assinaturasPartes: Array<{ papel: string; imagem: string }> = []
    const { data: procAssin } = await admin
      .from('contrato_assinaturas')
      .select('id')
      .eq('tipo_contrato', 'administracao').eq('contrato_id', id).neq('status', 'cancelado')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (procAssin) {
      const { data: sigs } = await admin
        .from('contrato_assinatura_signatarios')
        .select('papel, assinatura_b64').eq('assinatura_id', procAssin.id).eq('status', 'assinado')
      assinaturasPartes = (sigs ?? [])
        .filter(s => s.assinatura_b64)
        .map(s => ({ papel: s.papel ?? '', imagem: s.assinatura_b64 as string }))
    }

    // 2. Perfil emitente (administradora)
    const { data: perfil } = await admin
      .from('perfis')
      .select(`
        nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
        endereco_logradouro, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_uf, endereco_cep
      `)
      .eq('id', ownerId)
      .maybeSingle()

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

    // 3. Cláusulas DESTE contrato: usa o snapshot da geração (fonte de verdade);
    //    fallback ao banco genérico só para gerações antigas sem snapshot.
    const { data: geracao } = await admin
      .from('contrato_admin_geracoes')
      .select('id, clausulas, clausula_ids, testemunha_ids, anexo_documento_ids, capa_overrides, mostrar_modificacoes, modificacoes_texto')
      .eq('contrato_admin_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let clausulasRaw: Array<{ titulo: string; corpo: string; modificada?: boolean }> = []
    const snap = (geracao?.clausulas ?? []) as Array<{ titulo: string; corpo: string; modificada?: boolean }>
    if (Array.isArray(snap) && snap.length > 0) {
      clausulasRaw = snap.map(s => ({ titulo: s.titulo, corpo: s.corpo, modificada: s.modificada }))
    } else {
      let ids = (geracao?.clausula_ids as string[] | null) ?? null
      if (!ids || ids.length === 0) {
        const { data: todas } = await admin
          .from('contrato_clausulas').select('id')
          .eq('user_id', ownerId).eq('tipo', 'administracao').eq('ativa', true)
          .order('numero', { ascending: true })
        ids = (todas ?? []).map(x => x.id)
      }
      if (ids.length > 0) {
        const { data: bankCl } = await admin
          .from('contrato_clausulas').select('id, titulo, corpo').in('id', ids)
        const mapaCl = new Map((bankCl ?? []).map(cl => [cl.id, cl]))
        clausulasRaw = ids.map(id => mapaCl.get(id))
          .filter((x): x is NonNullable<typeof x> => !!x)
          .map(x => ({ titulo: x.titulo, corpo: x.corpo }))
      }
      if (clausulasRaw.length === 0) {
        const { data: todas } = await admin
          .from('contrato_clausulas').select('titulo, corpo')
          .eq('user_id', ownerId).eq('tipo', 'administracao').eq('ativa', true)
          .order('numero', { ascending: true })
        clausulasRaw = (todas ?? []).map(x => ({ titulo: x.titulo, corpo: x.corpo }))
      }
    }

    if (clausulasRaw.length === 0) {
      return NextResponse.json({
        error: 'Nenhuma cláusula no contrato. Abra o Editor de cláusulas e revise/reimporte o modelo.',
      }, { status: 400 })
    }

    // 4. Monta dados pros placeholders
    const prop = Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario
    const reprRaw = (c as { proprietario_representante?: unknown }).proprietario_representante
    const repr = (Array.isArray(reprRaw) ? reprRaw[0] : reprRaw) as { nome: string; cpf_cnpj: string | null } | null
    const reprCpf = fmtCpf(repr?.cpf_cnpj ?? null)
    const reprQualificacao = (c.proprietario_representante_qualificacao as string | null) ?? null
    const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
    const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

    const dadosContrato: DadosContrato = {
      locador: prop,  // proprietário aparece como "LOCADOR" em alguns placeholders
      locatario: null,
      fiador: null,
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
      contrato: null,
      administracao: {
        codigo: c.codigo,
        data_inicio: c.data_inicio,
        data_termino: c.data_termino,
        prazo_meses: c.prazo_meses,
        taxa_tipo: c.taxa_tipo,
        taxa_valor: c.taxa_valor,
        dia_repasse: c.dia_repasse,
        aviso_previo_dias: c.aviso_previo_dias,
        multa_rescisao_meses: c.multa_rescisao_meses,
        exclusividade: c.exclusividade,
        recebimento_comissao: c.recebimento_comissao,
        proprietario_representante_nome: repr?.nome ?? null,
        proprietario_representante_cpf: reprCpf,
        proprietario_representante_qualificacao: reprQualificacao,
      },
    }

    const clausulas: ContratoPDFClausula[] = clausulasRaw.map((cl, idx) => ({
      numero: idx + 1,
      titulo: cl.titulo,
      corpo: aplicarPlaceholders(cl.corpo, dadosContrato),
      modificada: cl.modificada ?? false,
    }))

    // Modo modificações: link de revisão (?rt) sempre mostra; PDF normal só se ligado.
    const mostrarModificacoes = viaRevisao || (geracao?.mostrar_modificacoes ?? false)

    // Testemunhas selecionadas
    const testemunhaIds = (geracao?.testemunha_ids ?? []) as string[]
    const { data: testemunhasRaw } = testemunhaIds.length > 0
      ? await admin
          .from('pessoas')
          .select('id, nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf')
          .in('id', testemunhaIds)
          .eq('user_id', ownerId)
      : { data: [] }

    // 4b. Monta resumo da capa (taxa, prazo, datas, exclusividade) + endereço do imóvel
    const taxaStr = c.taxa_tipo === 'fixo'
      ? `${fmtBRLNum(c.taxa_valor)} / mês`
      : `${formatPct(c.taxa_valor)} ao mês`
    const prazoStr = c.prazo_meses ? `${c.prazo_meses} meses` : (c.data_termino ? '—' : 'Indeterminado')
    const terminoStr = c.data_termino
      ? fmtData(c.data_termino)
      : (c.data_inicio && c.prazo_meses
          ? (() => {
              const ini = new Date(c.data_inicio + 'T00:00:00')
              const fim = new Date(ini.getFullYear(), ini.getMonth() + c.prazo_meses, ini.getDate() - 1)
              return fim.toLocaleDateString('pt-BR')
            })()
          : 'Indeterminado')

    let imovelEndereco = ''
    if (im?.endereco_completo) {
      imovelEndereco = [
        im.endereco_completo,
        im.endereco_numero ? `nº ${im.endereco_numero}` : null,
        im.endereco_complemento,
        bairro?.nome,
      ].filter(Boolean).join(', ')
    } else if (im?.endereco_resumido) {
      imovelEndereco = `${im.endereco_resumido}${bairro?.nome ? `, ${bairro.nome}` : ''}`
    }
    // Usa SÓ a descrição própria do imóvel (descricao_real) — não o texto de
    // marketing do anúncio. Limpa HTML, entidades e caracteres não imprimíveis.
    const limparTextoImovel = (s: string | null | undefined): string =>
      (s ?? '')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&lt;/gi, ' ').replace(/&gt;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
        .replace(/<[^>]*>/g, ' ')
        .replace(/\p{Cc}/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    let imovelDescricao = limparTextoImovel(im?.descricao_real).slice(0, 220)
    if (im?.area_construida_m2 && !imovelDescricao.includes('m²')) {
      imovelDescricao = imovelDescricao ? `${imovelDescricao} · ${im.area_construida_m2} m²` : `${im.area_construida_m2} m²`
    }

    // Overrides editáveis da capa (por geração)
    const ov = ((geracao?.capa_overrides ?? {}) as Record<string, string>)
    const pick = (k: string) => (typeof ov[k] === 'string' ? ov[k].trim() : '')

    const resumoLinhas = [
      { label: 'Taxa', valor: pick('taxa') || taxaStr },
      { label: 'Prazo', valor: pick('prazo') || prazoStr },
      { label: 'Início', valor: pick('inicio') || fmtData(c.data_inicio) },
      { label: 'Término', valor: pick('termino') || terminoStr },
      { label: 'Repasse', valor: pick('repasse') || (c.dia_repasse ? `Até o dia ${c.dia_repasse}` : '—') },
      { label: 'Exclusividade', valor: pick('exclusividade') || (c.exclusividade ? 'Sim' : 'Não') },
    ]
    if (pick('endereco')) imovelEndereco = pick('endereco')
    if (pick('descricao')) imovelDescricao = pick('descricao')

    // 5. Monta data pro PDF
    const pdfData: ContratoPDFData = {
      codigo: c.codigo,
      data_assinatura: new Date().toISOString().slice(0, 10),
      tipo_documento: 'administracao',
      incluir_capa: true,
      resumo_linhas: resumoLinhas,
      resumo_capa: {
        aluguel_str: '', prazo_str: prazoStr, inicio_str: fmtData(c.data_inicio),
        termino_str: terminoStr, garantia_str: '',
        imovel_endereco: imovelEndereco, imovel_descricao: imovelDescricao,
        observacao: pick('observacao') || undefined,
      },
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
      proprietario_representante_nome: repr?.nome ?? null,
      proprietario_representante_cpf: reprCpf,
      proprietario_representante_qualificacao: reprQualificacao,
      assinaturas_partes: assinaturasPartes,
      tem_administracao: true,
      admin_responsavel_nome: perfil?.nome ?? null,
      admin_responsavel_creci: perfil?.creci ?? null,
      // No contrato de administração não há locatário/cônjuge/fiador
      locatario_nome: prop?.nome ?? '[PREENCHER]',  // pra capa
      locatario_cpf: fmtCpf(prop?.cpf_cnpj ?? null),
      conjuge_nome: null,
      conjuge_cpf: null,
      moradores_adicionais: [],
      fiador_nome: null,
      fiador_cpf: null,
      testemunhas: testemunhaIds
        .map(id => (testemunhasRaw ?? []).find(t => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map(t => ({
          nome: t.nome,
          cpf: fmtCpf(t.cpf_cnpj),
          rg: t.rg ? [t.rg, t.rg_orgao_emissor, t.rg_uf].filter(Boolean).join(' ') : null,
        })),
      clausulas_seguradora_texto: null,
      clausulas,
      mostrar_modificacoes: mostrarModificacoes,
      modificacoes_texto: geracao?.modificacoes_texto ?? null,
      quadro_entrada: [],
      tabela_12_meses: { colunas: { iptu: false, condominio: false, seguro: false }, linhas: [] },
      termo_chaves: null,
    }

    const element = React.createElement(ContratoDocument, { data: pdfData }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    // Merge dos anexos selecionados
    const anexoIds = (geracao?.anexo_documento_ids ?? []) as string[]
    let finalBytes: Uint8Array = new Uint8Array(buffer)
    if (anexoIds.length > 0) {
      const { data: docs } = await admin
        .from('pessoas_documentos')
        .select('id, arquivo_path, mime_type')
        .in('id', anexoIds)
        .eq('user_id', ownerId)
      if (docs && docs.length > 0) {
        const mapaDoc = new Map(docs.map(d => [d.id, d]))
        const anexosBuffers: Array<{ buffer: Uint8Array; mime: string }> = []
        for (const id of anexoIds) {
          const d = mapaDoc.get(id)
          if (!d) continue
          const { data: blob } = await admin.storage.from('documentos-pessoas').download(d.arquivo_path)
          if (!blob) continue
          const ab = await blob.arrayBuffer()
          anexosBuffers.push({ buffer: new Uint8Array(ab), mime: d.mime_type ?? 'application/pdf' })
        }
        finalBytes = await mergeAnexos(finalBytes, anexosBuffers)
      }
    }

    // Carimba paginação no rodapé de todas as páginas
    finalBytes = await carimbarPaginacao(finalBytes, c.codigo)

    const filename = `contrato-administracao-${c.codigo}.pdf`
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
    console.error('[contrato-admin-pdf] erro:', msg, stack)
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
