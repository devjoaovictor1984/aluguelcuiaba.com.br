import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CertificadoAssinaturaDocument, type CertificadoData } from '@/lib/crm/certificado-assinatura-pdf'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    const { data: proc } = await admin
      .from('contrato_assinaturas')
      .select('id, user_id, tipo_contrato, contrato_id, titulo, status, pdf_hash')
      .eq('id', id)
      .maybeSingle()
    if (!proc) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

    // Autoriza: dono logado OU token de signatário deste processo
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const st = new URL(request.url).searchParams.get('st')
    let autorizado = !!user && user.id === proc.user_id
    if (!autorizado && st) {
      const { data: s } = await admin
        .from('contrato_assinatura_signatarios')
        .select('id')
        .eq('token', st)
        .eq('assinatura_id', proc.id)
        .maybeSingle()
      autorizado = !!s
    }
    if (!autorizado) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    if (proc.status !== 'concluido') {
      return NextResponse.json({ error: 'O contrato ainda não foi assinado por todas as partes.' }, { status: 400 })
    }

    const { data: signatarios } = await admin
      .from('contrato_assinatura_signatarios')
      .select('nome, email, papel, assinado_em, ip, geo, selfie_b64, assinatura_b64, token')
      .eq('assinatura_id', proc.id)
      .order('ordem', { ascending: true })

    const tokenInterno = (signatarios ?? [])[0]?.token
    if (!tokenInterno) return NextResponse.json({ error: 'Sem signatários.' }, { status: 400 })

    // Base URL da requisição (mesmo host, evita redirect apex/www)
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const base = `${proto}://${host}`
    const pdfPath = proc.tipo_contrato === 'administracao'
      ? `/api/contratos-admin/${proc.contrato_id}/pdf?st=${tokenInterno}`
      : `/api/contratos/${proc.contrato_id}/pdf?st=${tokenInterno}`

    const resp = await fetch(`${base}${pdfPath}`, { cache: 'no-store' })
    if (!resp.ok) return NextResponse.json({ error: 'Falha ao carregar o contrato.' }, { status: 502 })
    const contratoBytes = new Uint8Array(await resp.arrayBuffer())

    // Hash de integridade (grava na 1ª vez)
    const hash = proc.pdf_hash ?? createHash('sha256').update(contratoBytes).digest('hex')
    if (!proc.pdf_hash) {
      await admin.from('contrato_assinaturas').update({ pdf_hash: hash }).eq('id', proc.id)
    }

    // Emitente
    const { data: perfil } = await admin.from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()
    const emitente = perfil?.razao_social || perfil?.nome || 'AluguelCuiabá'

    const certData: CertificadoData = {
      titulo: proc.titulo ?? 'Contrato',
      tipo_contrato: proc.tipo_contrato as 'locacao' | 'administracao',
      emitente_nome: emitente,
      concluido_em: null,
      hash,
      signatarios: (signatarios ?? []).map(s => ({
        nome: s.nome, email: s.email, papel: s.papel,
        assinado_em: s.assinado_em, ip: s.ip, geo: s.geo,
        selfie_b64: s.selfie_b64, assinatura_b64: s.assinatura_b64,
      })),
    }

    const element = React.createElement(CertificadoAssinaturaDocument, { data: certData }) as unknown as React.ReactElement<DocumentProps>
    const certBuffer = await renderToBuffer(element)

    // Merge: contrato + certificado
    const final = await PDFDocument.create()
    const contratoPdf = await PDFDocument.load(contratoBytes)
    const certPdf = await PDFDocument.load(new Uint8Array(certBuffer))
    for (const p of await final.copyPages(contratoPdf, contratoPdf.getPageIndices())) final.addPage(p)
    for (const p of await final.copyPages(certPdf, certPdf.getPageIndices())) final.addPage(p)
    const finalBytes = await final.save()

    return new Response(finalBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-assinado-${proc.titulo ?? proc.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pdf-final] erro:', msg)
    return NextResponse.json({ error: 'Falha ao gerar o contrato assinado', detail: msg }, { status: 500 })
  }
}
