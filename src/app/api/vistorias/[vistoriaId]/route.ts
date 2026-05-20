import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VistoriaDocument, type VistoriaPDFData, type VistoriaPDFItem } from '@/lib/crm/vistoria-pdf'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vistoriaId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { vistoriaId } = await params
  const debug = new URL(request.url).searchParams.get('debug') === '1'
  const admin = createAdminClient()

  // Carrega vistoria + contrato + partes.
  // FK explícita (vistorias_contrato_id_fkey) pra evitar ambiguidade com
  // os FKs reversos contratos_locacao.vistoria_entrada_id/saida_id.
  const { data: vistoria, error } = await admin
    .from('vistorias')
    .select(`
      id, user_id, tipo, status, data_vistoria, observacoes_gerais,
      qtd_chaves, qtd_controles, assinada_em, assinada_ip,
      assinatura_inquilino_url, inquilino_observacoes,
      contrato:contratos_locacao!vistorias_contrato_id_fkey(
        codigo,
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
        imovel:imoveis(titulo, endereco_resumido, bairro:bairros(nome))
      )
    `)
    .eq('id', vistoriaId)
    .single()

  if (debug) {
    // Tentativa adicional sem o join, pra diagnóstico
    const { data: vistoriaSimples, error: erroSimples } = await admin
      .from('vistorias').select('id, user_id, contrato_id, status, tipo, data_vistoria')
      .eq('id', vistoriaId).maybeSingle()
    return NextResponse.json({
      vistoria_id_buscado: vistoriaId,
      meu_user_id: user.id,
      query_com_join: { erro: error?.message ?? null, encontrou: !!vistoria },
      query_simples: { erro: erroSimples?.message ?? null, data: vistoriaSimples },
      diagnostico: !vistoriaSimples
        ? 'Vistoria não existe no banco — criação deve ter falhado silenciosamente.'
        : vistoriaSimples.user_id !== user.id
        ? `Vistoria pertence a outro user (${vistoriaSimples.user_id.slice(0, 8)}…). Logue com a conta dona.`
        : error
        ? `Join falhou: ${error.message}. Provável: contrato deletado/inválido ou coluna ausente.`
        : 'Tudo certo, deveria funcionar.',
    })
  }

  if (error || !vistoria) return NextResponse.json({ error: 'Vistoria não encontrada' }, { status: 404 })
  if (vistoria.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  // Carrega itens + fotos
  const [{ data: itensRaw }, { data: fotosRaw }] = await Promise.all([
    admin.from('vistoria_itens')
      .select('id, comodo, item, estado, observacao, observacao_inquilino, ordem')
      .eq('vistoria_id', vistoriaId)
      .order('ordem', { ascending: true }),
    admin.from('vistoria_fotos')
      .select('id, vistoria_item_id, arquivo_path, origem')
      .eq('vistoria_id', vistoriaId)
      .order('created_at', { ascending: true }),
  ])

  // Resolve URLs públicas pra fotos
  const fotosPorItem: Record<string, { corretor: string[]; inquilino: string[] }> = {}
  for (const f of (fotosRaw ?? [])) {
    if (!f.vistoria_item_id) continue
    const { data } = admin.storage.from('vistorias-fotos').getPublicUrl(f.arquivo_path)
    const k = f.vistoria_item_id
    if (!fotosPorItem[k]) fotosPorItem[k] = { corretor: [], inquilino: [] }
    if (f.origem === 'inquilino') fotosPorItem[k].inquilino.push(data.publicUrl)
    else fotosPorItem[k].corretor.push(data.publicUrl)
  }

  // Perfil emitente
  const { data: perfil } = await admin
    .from('perfis').select('nome').eq('id', user.id).maybeSingle()

  type ContratoRel = {
    codigo: string
    inquilino: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
    imovel: {
      titulo: string; endereco_resumido: string | null
      bairro: { nome: string } | { nome: string }[] | null
    } | null
  }
  const contratoRaw = vistoria.contrato as unknown as ContratoRel | ContratoRel[]
  const contrato = Array.isArray(contratoRaw) ? contratoRaw[0] : contratoRaw
  const inquilinoRaw = contrato.inquilino
  const inquilino = Array.isArray(inquilinoRaw) ? inquilinoRaw[0] : inquilinoRaw
  const imovelRaw = contrato.imovel
  const imovel = Array.isArray(imovelRaw) ? imovelRaw[0] : imovelRaw
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)
  const enderecoImovel = imovel?.endereco_resumido
    ? `${imovel.endereco_resumido}${bairro?.nome ? ` - ${bairro.nome}` : ''}`
    : null

  const itens: VistoriaPDFItem[] = (itensRaw ?? []).map(it => ({
    id: it.id,
    comodo: it.comodo,
    item: it.item,
    estado: it.estado,
    observacao: it.observacao,
    observacao_inquilino: it.observacao_inquilino,
    fotos_corretor: fotosPorItem[it.id]?.corretor ?? [],
    fotos_inquilino: fotosPorItem[it.id]?.inquilino ?? [],
  }))

  const dados: VistoriaPDFData = {
    tipo: vistoria.tipo as 'entrada' | 'saida',
    data_vistoria: vistoria.data_vistoria,
    observacoes_gerais: vistoria.observacoes_gerais,
    qtd_chaves: vistoria.qtd_chaves ?? 0,
    qtd_controles: vistoria.qtd_controles ?? 0,
    inquilino_observacoes: vistoria.inquilino_observacoes,
    assinatura_inquilino_url: vistoria.assinatura_inquilino_url
      ? vistoria.assinatura_inquilino_url.split('?')[0]  // remove cache-buster
      : null,
    assinada_em: vistoria.assinada_em,
    assinada_ip: vistoria.assinada_ip,
    anunciante_nome: perfil?.nome ?? 'AluguelCuiabá',
    contrato_codigo: contrato.codigo,
    imovel_titulo: imovel?.titulo ?? null,
    imovel_endereco: enderecoImovel,
    inquilino_nome: inquilino?.nome ?? '—',
    inquilino_cpf: inquilino?.cpf_cnpj ?? null,
    itens,
  }

  const element = React.createElement(VistoriaDocument, { data: dados }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  const filename = `vistoria-${vistoria.tipo}-${contrato.codigo}.pdf`
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
