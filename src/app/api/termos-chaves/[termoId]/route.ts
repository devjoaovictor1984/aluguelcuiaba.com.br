import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TermoEntregaDocument, type TermoEntregaPDFData } from '@/lib/crm/termo-entrega-pdf'
import { assinarUrlSelfie } from '@/lib/storage/selfies'
import { montarEnderecoImovel, type ImovelParaEndereco } from '@/lib/crm/endereco-imovel'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ termoId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { termoId } = await params
  const admin = createAdminClient()

  const { data: termo, error } = await admin
    .from('termos_entrega_chaves')
    .select(`
      id, user_id, status, data_entrega,
      qtd_chaves_entregues, qtd_controles_entregues, estado_entrega, observacoes,
      assinatura_locatario_url, selfie_locatario_url, assinado_locatario_em, assinado_locatario_ip, observacoes_locatario,
      assinatura_locador_url, selfie_locador_url, assinado_locador_em, assinado_locador_ip,
      contrato:contratos_locacao(
        codigo,
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
        imovel:imoveis(titulo, endereco_resumido, endereco_completo,
          endereco_numero, endereco_complemento, bairro:bairros(nome))
      )
    `)
    .eq('id', termoId)
    .single()

  if (error || !termo) return NextResponse.json({ error: 'Termo não encontrado' }, { status: 404 })
  if (termo.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  // Perfil emitente (mesma fonte do recibo/vistoria)
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
    imovel: ({ titulo: string; bairro: { nome: string } | { nome: string }[] | null } & ImovelParaEndereco) | null
  }
  const contratoRaw = termo.contrato as unknown as ContratoRel | ContratoRel[]
  const contrato = Array.isArray(contratoRaw) ? contratoRaw[0] : contratoRaw
  const inquilinoRaw = contrato.inquilino
  const inquilino = Array.isArray(inquilinoRaw) ? inquilinoRaw[0] : inquilinoRaw
  const imovelRaw = contrato.imovel
  const imovel = Array.isArray(imovelRaw) ? imovelRaw[0] : imovelRaw
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)
  const enderecoImovel = montarEnderecoImovel(
    imovel ? { ...imovel, bairro_nome: bairro?.nome ?? null } : null,
  )

  const semCache = (u: string | null) => (u ? u.split('?')[0] : null)

  // Selfies ficam em bucket privado → URL assinada (curta) só pro render.
  const [selfieLocatario, selfieLocador] = await Promise.all([
    assinarUrlSelfie(admin, termo.selfie_locatario_url, 300),
    assinarUrlSelfie(admin, termo.selfie_locador_url, 300),
  ])

  const dados: TermoEntregaPDFData = {
    data_entrega: termo.data_entrega,
    qtd_chaves: termo.qtd_chaves_entregues ?? 0,
    qtd_controles: termo.qtd_controles_entregues ?? 0,
    estado_entrega: termo.estado_entrega,
    observacoes: termo.observacoes,
    status: termo.status,
    assinatura_locatario_url: semCache(termo.assinatura_locatario_url),
    selfie_locatario_url: selfieLocatario,
    assinado_locatario_em: termo.assinado_locatario_em,
    assinado_locatario_ip: termo.assinado_locatario_ip,
    observacoes_locatario: termo.observacoes_locatario,
    assinatura_locador_url: semCache(termo.assinatura_locador_url),
    selfie_locador_url: selfieLocador,
    assinado_locador_em: termo.assinado_locador_em,
    assinado_locador_ip: termo.assinado_locador_ip,
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
  }

  const element = React.createElement(TermoEntregaDocument, { data: dados }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  const filename = `termo-entrega-chaves-${contrato.codigo}.pdf`
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
