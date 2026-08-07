import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReciboDocument, type ReciboData } from '@/lib/crm/recibo-pdf'
import { montarEmitenteRecibo } from '@/lib/crm/recibo-emitente'
import { montarEnderecoImovel, type ImovelParaEndereco } from '@/lib/crm/endereco-imovel'
import React from 'react'

export const runtime = 'nodejs'

// Recibo consolidado de pagamento à vista: um único documento pelo valor total
// de todas as parcelas do contrato. Só vale para contratos pagamento_antecipado.
function mmAaaa(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-')
  return `${m}/${y}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contratoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contratoId } = await params
  const admin = createAdminClient()

  const { data: contrato, error } = await admin
    .from('contratos_locacao')
    .select(`
      id, codigo, user_id, pagamento_antecipado, data_pagamento_antecipado, recibo_avista_numero,
      inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
      imovel:imoveis(titulo, endereco_resumido, endereco_completo,
        endereco_numero, endereco_complemento, bairro:bairros(nome))
    `)
    .eq('id', contratoId)
    .single()

  if (error || !contrato) {
    return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  }
  if (contrato.user_id !== user.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  if (!contrato.pagamento_antecipado) {
    return NextResponse.json({ error: 'Este contrato não é de pagamento à vista.' }, { status: 400 })
  }

  // Soma de todas as parcelas
  const { data: parcelas } = await admin
    .from('parcelas_aluguel')
    .select('numero, mes_referencia, valor_aluguel, valor_seguro, valor_iptu, valor_condominio, valor_total')
    .eq('contrato_id', contratoId)
    .order('numero', { ascending: true })

  if (!parcelas || parcelas.length === 0) {
    return NextResponse.json({ error: 'Contrato sem parcelas.' }, { status: 400 })
  }

  const soma = (campo: 'valor_aluguel' | 'valor_seguro' | 'valor_iptu' | 'valor_condominio' | 'valor_total') =>
    parcelas.reduce((acc, p) => acc + (Number(p[campo]) || 0), 0)

  const totalAluguel = soma('valor_aluguel')
  const totalSeguro = soma('valor_seguro')
  const totalIptu = soma('valor_iptu')
  const totalCondominio = soma('valor_condominio')
  const totalGeral = soma('valor_total')

  const inicio = parcelas[0].mes_referencia
  const fim = parcelas[parcelas.length - 1].mes_referencia
  const periodoDescricao = `${parcelas.length} ${parcelas.length === 1 ? 'parcela' : 'parcelas'} (${mmAaaa(inicio)} a ${mmAaaa(fim)})`

  // Número do recibo consolidado: gerado na 1ª emissão e persistido.
  let numeroRecibo = contrato.recibo_avista_numero as number | null
  if (!numeroRecibo) {
    const { data: maiores } = await admin
      .from('parcelas_aluguel')
      .select('numero_recibo')
      .eq('contrato_id', contratoId)
      .not('numero_recibo', 'is', null)
      .order('numero_recibo', { ascending: false })
      .limit(1)
    numeroRecibo = ((maiores?.[0]?.numero_recibo as number | undefined) ?? 0) + 1
    await admin
      .from('contratos_locacao')
      .update({ recibo_avista_numero: numeroRecibo })
      .eq('id', contratoId)
  }

  const emitente = await montarEmitenteRecibo(admin, user.id, user.email ?? null)

  const inquilinoRaw = (contrato as unknown as { inquilino: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] }).inquilino
  const inquilino = Array.isArray(inquilinoRaw) ? inquilinoRaw[0] : inquilinoRaw

  const imovelRaw = (contrato as unknown as { imovel: ({ titulo: string; bairro: { nome: string } | { nome: string }[] | null } & ImovelParaEndereco) | null }).imovel
  const imovel = Array.isArray(imovelRaw) ? imovelRaw[0] : imovelRaw
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)
  const enderecoImovel = montarEnderecoImovel(
    imovel ? { ...imovel, bairro_nome: bairro?.nome ?? null } : null,
  )

  const dataPagamento = (contrato.data_pagamento_antecipado as string | null) ?? new Date().toISOString().slice(0, 10)

  const recibo: ReciboData = {
    numero_recibo: numeroRecibo,
    contrato_codigo: contrato.codigo,
    inquilino_nome: inquilino?.nome ?? '—',
    inquilino_cpf: inquilino?.cpf_cnpj ?? null,
    imovel_titulo: imovel?.titulo ?? null,
    imovel_endereco: enderecoImovel,
    valor_aluguel: totalAluguel,
    valor_seguro: totalSeguro,
    valor_iptu: totalIptu,
    valor_condominio: totalCondominio,
    valor_total: totalGeral,
    valor_pago: totalGeral,
    juros_multa: 0,
    desconto: 0,
    mes_referencia: inicio,
    periodo_descricao: periodoDescricao,
    data_pagamento: dataPagamento,
    ...emitente,
  }

  const element = React.createElement(ReciboDocument, { data: recibo }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-avista-${contrato.codigo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
