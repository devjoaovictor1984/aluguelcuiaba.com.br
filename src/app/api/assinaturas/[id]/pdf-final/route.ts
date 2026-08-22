import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CertificadoAssinaturaDocument } from '@/lib/crm/certificado-assinatura-pdf'
import { montarCertificado } from '@/lib/crm/certificado-dados'
import { garantirCodigoValidacao } from '@/lib/crm/validacao-codigo'
import { carimbarValidacao } from '@/lib/crm/carimbo-validacao'
import { baixarViaFinal, subirViaFinal, caminhoViaFinal } from '@/lib/storage/contratos-assinados'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

function respostaPdf(bytes: Uint8Array, nomeArquivo: string) {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomeArquivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    const { data: proc } = await admin
      .from('contrato_assinaturas')
      .select('id, user_id, tipo_contrato, contrato_id, titulo, status, pdf_hash, concluido_em, codigo_validacao, pdf_final_path')
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

    const nomeArquivo = `contrato-assinado-${proc.titulo ?? proc.id}.pdf`

    // Já congelada (v84): serve o MESMO arquivo, sem remontar. É o que faz o
    // hash do certificado valer alguma coisa — remontar produzia bytes novos
    // a cada download e ninguém conseguia conferir nada.
    if (proc.pdf_final_path) {
      const guardado = await baixarViaFinal(admin, proc.pdf_final_path)
      if (guardado) return respostaPdf(guardado, nomeArquivo)
      // Sumiu do bucket: cai adiante e regera, em vez de estourar na cara
      // de quem só queria baixar o contrato.
      console.error('[pdf-final] via congelada não encontrada, regerando:', proc.pdf_final_path)
    }

    // Mesma montagem usada na prévia do certificado — uma fonte só pra trilha.
    // O hash só existe depois de carregar o contrato, então entra logo abaixo.
    const { cert, tokenInterno } = await montarCertificado(admin, {
      id: proc.id,
      user_id: proc.user_id,
      tipo_contrato: proc.tipo_contrato as 'locacao' | 'administracao',
      titulo: proc.titulo,
      concluido_em: proc.concluido_em,
    }, { hash: null, parcial: false })
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

    cert.hash = hash

    const element = React.createElement(CertificadoAssinaturaDocument, { data: cert }) as unknown as React.ReactElement<DocumentProps>
    const certBuffer = await renderToBuffer(element)

    // Merge: contrato + certificado
    const final = await PDFDocument.create()
    const contratoPdf = await PDFDocument.load(contratoBytes)
    const certPdf = await PDFDocument.load(new Uint8Array(certBuffer))
    for (const p of await final.copyPages(contratoPdf, contratoPdf.getPageIndices())) final.addPage(p)
    for (const p of await final.copyPages(certPdf, certPdf.getPageIndices())) final.addPage(p)

    // Carimbo de autenticidade: código + QR no rodapé de todas as páginas,
    // pra quem receber a via impressa poder conferir em /validar. Processos
    // concluídos antes da v83 ganham o código aqui, na 1ª geração.
    const codigo = await garantirCodigoValidacao(admin, proc.id, proc.codigo_validacao)
    if (codigo) await carimbarValidacao(final, { codigo, urlValidacao: `${base}/validar/${codigo}` })

    const finalBytes = await final.save()

    // Congela: sobe pro bucket e guarda o hash DO ARQUIVO INTEIRO — este sim
    // a pessoa consegue calcular no PDF que recebeu e conferir em /validar.
    const caminho = caminhoViaFinal(proc.user_id, proc.id)
    const hashFinal = createHash('sha256').update(finalBytes).digest('hex')
    const up = await subirViaFinal(admin, caminho, finalBytes)
    if (up.ok) {
      await admin.from('contrato_assinaturas').update({
        pdf_final_path: caminho,
        pdf_final_hash: hashFinal,
        pdf_final_em: new Date().toISOString(),
      }).eq('id', proc.id)
    } else {
      // Sem congelar o download ainda funciona; só não vira referência.
      console.error('[pdf-final] falha ao congelar a via final:', up.error)
    }

    return respostaPdf(finalBytes, nomeArquivo)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pdf-final] erro:', msg)
    return NextResponse.json({ error: 'Falha ao gerar o contrato assinado', detail: msg }, { status: 500 })
  }
}
