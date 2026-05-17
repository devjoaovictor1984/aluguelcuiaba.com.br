import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReciboDocument, type ReciboData } from '@/lib/crm/recibo-pdf'
import React from 'react'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ parcelaId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { parcelaId } = await params
  const admin = createAdminClient()

  // Busca parcela + contrato + relacionamentos
  const { data: parcela, error } = await admin
    .from('parcelas_aluguel')
    .select(`
      id, numero, numero_recibo, mes_referencia, vencimento,
      valor_aluguel, valor_seguro, valor_iptu, valor_condominio,
      valor_total, valor_pago, juros_multa, desconto, data_pagamento, status_pagamento,
      contrato:contratos_locacao!inner(
        id, codigo, user_id,
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
        imovel:imoveis(titulo, endereco_resumido, bairro:bairros(nome))
      )
    `)
    .eq('id', parcelaId)
    .single()

  if (error || !parcela) {
    return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })
  }

  const contratoRaw = Array.isArray(parcela.contrato) ? parcela.contrato[0] : parcela.contrato
  if (!contratoRaw || contratoRaw.user_id !== user.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // Garante numero_recibo: usa o já gravado ou o próximo sequencial do contrato
  let numeroRecibo = parcela.numero_recibo
  if (!numeroRecibo) {
    const { data: maiores } = await admin
      .from('parcelas_aluguel')
      .select('numero_recibo')
      .eq('contrato_id', contratoRaw.id)
      .not('numero_recibo', 'is', null)
      .order('numero_recibo', { ascending: false })
      .limit(1)
    numeroRecibo = ((maiores?.[0]?.numero_recibo as number | undefined) ?? 0) + 1
    await admin
      .from('parcelas_aluguel')
      .update({ numero_recibo: numeroRecibo })
      .eq('id', parcelaId)
  }

  // Dados do emitente (perfil + site_config como fallback de logo)
  const { data: perfil } = await admin
    .from('perfis')
    .select(`
      nome, cpf, telefone,
      endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado,
      recibo_logo_url, recibo_emitente_nome, recibo_assinatura_url,
      recibo_mostrar_linha, recibo_assinatura_sobre_linha
    `)
    .eq('id', user.id)
    .single()

  const { data: configs } = await admin
    .from('site_config')
    .select('chave, valor')
    .in('chave', ['logo_url'])
  // Logo do recibo personalizada tem prioridade; fallback é o logo do portal.
  const logoUrl = perfil?.recibo_logo_url
    ?? configs?.find(c => c.chave === 'logo_url')?.valor
    ?? null

  const endereco = [
    perfil?.endereco_logradouro && perfil.endereco_numero
      ? `${perfil.endereco_logradouro}, ${perfil.endereco_numero}` : perfil?.endereco_logradouro,
    perfil?.endereco_bairro,
    perfil?.endereco_cidade && perfil?.endereco_estado
      ? `${perfil.endereco_cidade}/${perfil.endereco_estado}` : perfil?.endereco_cidade,
  ].filter(Boolean).join(' - ')

  const inquilinoRaw = (contratoRaw as unknown as { inquilino: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] }).inquilino
  const inquilino = Array.isArray(inquilinoRaw) ? inquilinoRaw[0] : inquilinoRaw

  const imovelRaw = (contratoRaw as unknown as { imovel: { titulo: string; endereco_resumido: string | null; bairro: { nome: string } | { nome: string }[] | null } | null }).imovel
  const imovel = Array.isArray(imovelRaw) ? imovelRaw[0] : imovelRaw
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)
  const enderecoImovel = imovel?.endereco_resumido
    ? `${imovel.endereco_resumido}${bairro?.nome ? ` - ${bairro.nome}` : ''}`
    : null

  const recibo: ReciboData = {
    numero_recibo: numeroRecibo,
    contrato_codigo: contratoRaw.codigo,
    inquilino_nome: inquilino?.nome ?? '—',
    inquilino_cpf: inquilino?.cpf_cnpj ?? null,
    imovel_titulo: imovel?.titulo ?? null,
    imovel_endereco: enderecoImovel,
    valor_aluguel: parcela.valor_aluguel ?? 0,
    valor_seguro: parcela.valor_seguro ?? 0,
    valor_iptu: parcela.valor_iptu ?? 0,
    valor_condominio: parcela.valor_condominio ?? 0,
    valor_total: parcela.valor_total ?? 0,
    valor_pago: parcela.valor_pago ?? parcela.valor_total ?? 0,
    juros_multa: parcela.juros_multa ?? 0,
    desconto: parcela.desconto ?? 0,
    mes_referencia: parcela.mes_referencia,
    data_pagamento: parcela.data_pagamento ?? new Date().toISOString().slice(0, 10),
    emitente_nome: perfil?.nome ?? 'AluguelCuiabá',
    emitente_cpf_cnpj: perfil?.cpf ?? null,
    emitente_endereco: endereco || null,
    emitente_telefone: perfil?.telefone ?? null,
    cidade: perfil?.endereco_cidade ?? 'Cuiabá',
    logo_url: logoUrl,
    assinatura_url: perfil?.recibo_assinatura_url ?? null,
    assinatura_nome: perfil?.recibo_emitente_nome ?? null,
    mostrar_linha_assinatura: perfil?.recibo_mostrar_linha ?? true,
    assinatura_sobre_linha: perfil?.recibo_assinatura_sobre_linha ?? true,
  }

  const element = React.createElement(ReciboDocument, { data: recibo }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-${String(numeroRecibo).padStart(4, '0')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
