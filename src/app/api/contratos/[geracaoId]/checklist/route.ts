import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rodarChecklist, contagem, bloqueiaGeracao, type DadosChecklist } from '@/lib/contratos/checklist'

export const dynamic = 'force-dynamic'

/**
 * GET /api/contratos/[geracaoId]/checklist
 * Retorna a lista de validações antes de gerar o PDF.
 * Informativo — não bloqueia a geração no servidor (cliente decide).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ geracaoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { geracaoId } = await params
  const admin = createAdminClient()

  const { data: geracao } = await admin
    .from('contrato_geracoes')
    .select('id, user_id, contrato_id')
    .eq('id', geracaoId)
    .maybeSingle()

  if (!geracao || geracao.user_id !== user.id) {
    return NextResponse.json({ error: 'Geração não encontrada' }, { status: 404 })
  }

  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select(`
      tipo_atuacao, tipo_mobilia, tem_inventario_bens, aceita_pet,
      garantia_tipo, caucao_valor,
      seguro_fianca_seguradora, seguro_fianca_apolice,
      data_inicio, data_termino, duracao_meses, valor_aluguel, dia_vencimento,
      proprietario:pessoas!proprietario_id(nome, cpf_cnpj),
      inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
      fiador:pessoas!fiador_id(nome),
      imovel:imoveis(endereco_resumido, endereco_numero, endereco_complemento)
    `)
    .eq('id', geracao.contrato_id)
    .maybeSingle()

  if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  // perfil_anunciante pra checar CNPJ/CRECI-J
  const { data: perfil } = await admin
    .from('perfis')
    .select('cnpj, creci_juridico')
    .eq('user_id', user.id)
    .maybeSingle()

  const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const fia = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
  const imv = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel

  const enderecoPartes = imv
    ? [imv.endereco_resumido, imv.endereco_numero, imv.endereco_complemento].filter(Boolean).join(', ')
    : null

  const dados: DadosChecklist = {
    tipo_atuacao: (contrato.tipo_atuacao ?? 'administracao') as DadosChecklist['tipo_atuacao'],
    admin_cnpj: perfil?.cnpj ?? null,
    admin_creci_juridico: perfil?.creci_juridico ?? null,
    tipo_mobilia: (contrato.tipo_mobilia ?? 'sem') as DadosChecklist['tipo_mobilia'],
    tem_inventario_bens: contrato.tem_inventario_bens ?? false,
    locador_nome: prop?.nome ?? null,
    locador_cpf: prop?.cpf_cnpj ?? null,
    locatario_nome: inq?.nome ?? null,
    locatario_cpf: inq?.cpf_cnpj ?? null,
    imovel_endereco: enderecoPartes || null,
    garantia_tipo: contrato.garantia_tipo ?? null,
    fiador_nome: fia?.nome ?? null,
    seguro_fianca_seguradora: contrato.seguro_fianca_seguradora ?? null,
    seguro_fianca_apolice: contrato.seguro_fianca_apolice ?? null,
    caucao_valor: contrato.caucao_valor ?? null,
    data_inicio: contrato.data_inicio ?? null,
    data_termino: contrato.data_termino ?? null,
    duracao_meses: contrato.duracao_meses ?? null,
    valor_aluguel: contrato.valor_aluguel ?? null,
    dia_vencimento: contrato.dia_vencimento ?? null,
  }

  const itens = rodarChecklist(dados)
  return NextResponse.json({
    itens,
    contagem: contagem(itens),
    bloqueia: bloqueiaGeracao(itens),
  })
}
