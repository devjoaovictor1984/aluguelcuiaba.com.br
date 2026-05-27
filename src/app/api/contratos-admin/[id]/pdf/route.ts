import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratoDocument, type ContratoPDFData, type ContratoPDFClausula } from '@/lib/crm/contrato-pdf'
import { aplicarPlaceholders, type DadosContrato } from '@/lib/contratos/montar'
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const admin = createAdminClient()

    // 1. Carrega contrato de administração + proprietário + imóvel
    const { data: c } = await admin
      .from('contratos_administracao')
      .select(`
        *,
        proprietario:pessoas!proprietario_id(
          nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
          nacionalidade, estado_civil, profissao,
          endereco_logradouro, endereco_numero, endereco_complemento,
          endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
        ),
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
    if (c.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // 2. Perfil emitente (administradora)
    const { data: perfil } = await admin
      .from('perfis')
      .select(`
        nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
        endereco_logradouro, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_uf, endereco_cep
      `)
      .eq('id', user.id)
      .maybeSingle()

    const cnpjFmt = perfil?.cnpj
      ? perfil.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : null
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

    // 3a. Tenta pegar a geração existente desse contrato (ordem editada pelo user)
    const { data: geracao } = await admin
      .from('contrato_admin_geracoes')
      .select('id, clausula_ids, testemunha_ids, anexo_documento_ids')
      .eq('contrato_admin_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 3b. Define IDs das cláusulas: ordem da geração se existir, senão todas
    let clausulaIdsOrdem: string[] | null = (geracao?.clausula_ids as string[] | null) ?? null

    if (!clausulaIdsOrdem || clausulaIdsOrdem.length === 0) {
      // Fallback: todas tipo='administracao' ativas do user, ordenadas
      const { data: todas } = await admin
        .from('contrato_clausulas')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'administracao')
        .eq('ativa', true)
        .order('numero', { ascending: true })
      clausulaIdsOrdem = (todas ?? []).map(x => x.id)
    }

    if (clausulaIdsOrdem.length === 0) {
      return NextResponse.json({
        error: 'Nenhuma cláusula de administração cadastrada. Vá em /painel/contratos/clausulas e reimporte o modelo.',
      }, { status: 400 })
    }

    const { data: clausulasRawUnordered } = await admin
      .from('contrato_clausulas')
      .select('id, titulo, corpo, numero')
      .in('id', clausulaIdsOrdem)

    // Reordena seguindo clausulaIdsOrdem
    const mapaCl = new Map((clausulasRawUnordered ?? []).map(cl => [cl.id, cl]))
    const clausulasRaw = clausulaIdsOrdem
      .map(id => mapaCl.get(id))
      .filter((x): x is NonNullable<typeof x> => !!x)

    // 4. Monta dados pros placeholders
    const prop = Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario
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
      },
    }

    const clausulas: ContratoPDFClausula[] = clausulasRaw.map((cl, idx) => ({
      numero: idx + 1,
      titulo: cl.titulo,
      corpo: aplicarPlaceholders(cl.corpo, dadosContrato),
    }))

    // Testemunhas selecionadas
    const testemunhaIds = (geracao?.testemunha_ids ?? []) as string[]
    const { data: testemunhasRaw } = testemunhaIds.length > 0
      ? await admin
          .from('pessoas')
          .select('id, nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf')
          .in('id', testemunhaIds)
          .eq('user_id', user.id)
      : { data: [] }

    // 5. Monta data pro PDF
    const pdfData: ContratoPDFData = {
      codigo: c.codigo,
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
        .eq('user_id', user.id)
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
