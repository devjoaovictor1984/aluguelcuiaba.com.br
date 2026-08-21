import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CertificadoAssinaturaDocument } from '@/lib/crm/certificado-assinatura-pdf'
import { montarCertificado } from '@/lib/crm/certificado-dados'
import { garantirCodigoValidacao } from '@/lib/crm/validacao-codigo'
import { carimbarValidacao } from '@/lib/crm/carimbo-validacao'
import { PDFDocument } from 'pdf-lib'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Certificado de assinatura AVULSO (sem o contrato junto).
 *
 * Serve pro corretor conferir/entregar a trilha de auditoria antes de todos
 * assinarem: com o processo em andamento sai marcado como PRÉVIA, listando só
 * quem já assinou. Concluído, sai igual ao que vai anexo no PDF final.
 *
 * Só o dono do processo abre — a trilha traz selfie e localização das partes,
 * então não vale liberar por token de signatário como no pdf-final.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    const { data: proc } = await admin
      .from('contrato_assinaturas')
      .select('id, user_id, tipo_contrato, titulo, status, pdf_hash, concluido_em, codigo_validacao')
      .eq('id', id)
      .maybeSingle()
    if (!proc) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== proc.user_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const concluido = proc.status === 'concluido'
    const { cert } = await montarCertificado(admin, {
      id: proc.id,
      user_id: proc.user_id,
      tipo_contrato: proc.tipo_contrato as 'locacao' | 'administracao',
      titulo: proc.titulo,
      concluido_em: proc.concluido_em,
    }, {
      // O hash só é gravado quando o PDF final é gerado; na prévia ainda não
      // existe contrato assinado pra ter integridade a declarar.
      hash: concluido ? proc.pdf_hash : null,
      parcial: !concluido,
    })

    const element = React.createElement(CertificadoAssinaturaDocument, { data: cert }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    // Concluído, o certificado avulso circula sozinho — leva o mesmo carimbo
    // de autenticidade da via final. Na prévia não: ainda não há o que validar.
    let saida: Uint8Array = new Uint8Array(buffer)
    if (concluido) {
      const codigo = await garantirCodigoValidacao(admin, proc.id, proc.codigo_validacao)
      if (codigo) {
        const proto = request.headers.get('x-forwarded-proto') ?? 'https'
        const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
        const doc = await PDFDocument.load(saida)
        await carimbarValidacao(doc, { codigo, urlValidacao: `${proto}://${host}/validar/${codigo}` })
        saida = new Uint8Array(await doc.save())
      }
    }

    const nome = `certificado${concluido ? '' : '-previa'}-${proc.titulo ?? proc.id}.pdf`
    return new Response(saida as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[certificado] erro:', msg)
    return NextResponse.json({ error: 'Falha ao gerar o certificado', detail: msg }, { status: 500 })
  }
}
