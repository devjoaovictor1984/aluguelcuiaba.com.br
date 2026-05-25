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

  // Carrega itens + fotos. Tenta SELECT com comodo; se v22 não rodou, fallback.
  const itensQ = admin.from('vistoria_itens')
    .select('id, comodo, item, estado, observacao, observacao_inquilino, ordem')
    .eq('vistoria_id', vistoriaId)
    .order('ordem', { ascending: true })

  type FotoCarregada = { vistoria_item_id: string | null; comodo: string | null; arquivo_path: string; origem: string }
  let fotosRaw: FotoCarregada[] = []
  {
    const r = await admin.from('vistoria_fotos')
      .select('id, vistoria_item_id, comodo, arquivo_path, origem')
      .eq('vistoria_id', vistoriaId)
      .order('created_at', { ascending: true })
    if (r.error?.message?.includes('comodo')) {
      const r2 = await admin.from('vistoria_fotos')
        .select('id, vistoria_item_id, arquivo_path, origem')
        .eq('vistoria_id', vistoriaId)
        .order('created_at', { ascending: true })
      fotosRaw = ((r2.data ?? []) as Array<Omit<FotoCarregada, 'comodo'>>).map(f => ({ ...f, comodo: null }))
    } else {
      fotosRaw = (r.data ?? []) as FotoCarregada[]
    }
  }
  const { data: itensRaw } = await itensQ

  // 3 escopos de fotos:
  //  1. Item → linha do item
  //  2. Cômodo → galeria no header do cômodo
  //  3. Geral → galeria no topo
  const fotosPorItem: Record<string, { corretor: string[]; inquilino: string[] }> = {}
  const fotosPorComodo: Record<string, string[]> = {}
  const fotosGerais: string[] = []
  for (const f of fotosRaw) {
    const { data } = admin.storage.from('vistorias-fotos').getPublicUrl(f.arquivo_path)
    if (f.vistoria_item_id) {
      const k = f.vistoria_item_id
      if (!fotosPorItem[k]) fotosPorItem[k] = { corretor: [], inquilino: [] }
      if (f.origem === 'inquilino') fotosPorItem[k].inquilino.push(data.publicUrl)
      else fotosPorItem[k].corretor.push(data.publicUrl)
    } else if (f.comodo) {
      if (!fotosPorComodo[f.comodo]) fotosPorComodo[f.comodo] = []
      fotosPorComodo[f.comodo].push(data.publicUrl)
    } else {
      fotosGerais.push(data.publicUrl)
    }
  }

  // Perfil emitente — dados institucionais reaproveitados do recibo
  const { data: perfil } = await admin
    .from('perfis')
    .select(`
      nome, razao_social, cnpj, creci, creci_juridico,
      recibo_logo_url,
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

  const enderecoPartes = [
    perfil?.endereco_logradouro,
    perfil?.endereco_numero ? `nº ${perfil.endereco_numero}` : null,
    perfil?.endereco_bairro,
    perfil?.endereco_cidade && perfil?.endereco_uf
      ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
      : perfil?.endereco_cidade ?? null,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean)
  const enderecoAnunciante = enderecoPartes.length ? enderecoPartes.join(', ') : null

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
    anunciante_razao_social: perfil?.razao_social ?? null,
    anunciante_cnpj: cnpjFmt,
    anunciante_creci: perfil?.creci ?? null,
    anunciante_creci_juridico: perfil?.creci_juridico ?? null,
    anunciante_logo_url: perfil?.recibo_logo_url ?? null,
    anunciante_endereco: enderecoAnunciante,
    anunciante_cidade_uf: perfil?.endereco_cidade && perfil?.endereco_uf
      ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
      : null,
    contrato_codigo: contrato.codigo,
    imovel_titulo: imovel?.titulo ?? null,
    imovel_endereco: enderecoImovel,
    inquilino_nome: inquilino?.nome ?? '—',
    inquilino_cpf: inquilino?.cpf_cnpj ?? null,
    itens,
    fotos_gerais: fotosGerais,
    fotos_por_comodo: fotosPorComodo,
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
