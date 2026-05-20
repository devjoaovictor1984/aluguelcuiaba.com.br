import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { EditorVistoria, type ItemRow, type FotoRow } from './_components/editor-vistoria'

interface Props {
  params: Promise<{ id: string; vistoriaId: string }>
  searchParams: Promise<{ debug?: string }>
}

export default async function VistoriaPage({ params, searchParams }: Props) {
  const { id, vistoriaId } = await params
  const sp = await searchParams
  const debug = sp.debug === '1'
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  // 1ª tentativa: query completa com joins
  const { data: vistoriaJoin, error: erroJoin } = await supabase
    .from('vistorias')
    .select(`*, contrato:contratos_locacao!inner(codigo, inquilino:pessoas!inquilino_id(nome, whatsapp, telefone), imovel:imoveis(titulo))`)
    .eq('id', vistoriaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  // Fallback 1: query simples (sem joins) — descobre se o problema é o embed
  const { data: vistoriaSimples, error: erroSimples } = await supabase
    .from('vistorias')
    .select('*')
    .eq('id', vistoriaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  // Fallback 2: via admin client — descobre se é RLS
  const { data: vistoriaAdmin, error: erroAdmin } = await admin
    .from('vistorias')
    .select('id, user_id, contrato_id, tipo, status')
    .eq('id', vistoriaId)
    .maybeSingle()

  if (debug) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold">Debug Vistoria</h1>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
{JSON.stringify({
  vistoriaId,
  contratoId: id,
  meu_user_id: acesso.userId,
  query_com_join: { erro: erroJoin?.message ?? null, encontrou: !!vistoriaJoin },
  query_simples_sem_join: { erro: erroSimples?.message ?? null, encontrou: !!vistoriaSimples, data: vistoriaSimples },
  query_admin_sem_rls: { erro: erroAdmin?.message ?? null, data: vistoriaAdmin },
}, null, 2)}
        </pre>
      </div>
    )
  }

  const vistoria = vistoriaJoin ?? vistoriaSimples
  if (!vistoria) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link href={`/painel/contratos/${id}/vistorias`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Vistorias
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h1 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertOctagon size={18} /> Não consegui carregar a vistoria
          </h1>
          <p className="text-sm text-amber-900 mb-3">
            {!vistoriaAdmin
              ? <>Esta vistoria <code className="bg-white px-1 rounded">{vistoriaId}</code> não existe no banco. Pode ter sido excluída.</>
              : vistoriaAdmin.user_id !== acesso.userId
              ? <>A vistoria existe mas pertence a outro usuário (<code className="bg-white px-1 rounded">{vistoriaAdmin.user_id.slice(0, 8)}…</code>). Logue com a conta correta.</>
              : erroJoin || erroSimples
              ? <>Erro técnico na consulta. Detalhes em <a href={`?debug=1`} className="underline font-semibold">?debug=1</a>.</>
              : <>Algo inesperado. Detalhes em <a href={`?debug=1`} className="underline font-semibold">?debug=1</a>.</>
            }
          </p>
          {(erroJoin || erroSimples) && (
            <p className="text-xs bg-white border border-amber-100 rounded p-2 font-mono break-all">
              {erroJoin?.message || erroSimples?.message}
            </p>
          )}
        </div>
      </div>
    )
  }

  const { data: itensRaw } = await supabase
    .from('vistoria_itens')
    .select('id, comodo, item, estado, observacao, observacao_inquilino, ordem')
    .eq('vistoria_id', vistoriaId)
    .order('ordem', { ascending: true })

  const { data: fotosRaw } = await supabase
    .from('vistoria_fotos')
    .select('id, vistoria_item_id, arquivo_path, origem, legenda, created_at')
    .eq('vistoria_id', vistoriaId)
    .order('created_at', { ascending: true })

  // Gera URLs públicas (bucket é public)
  const fotos: FotoRow[] = (fotosRaw ?? []).map(f => {
    const { data } = admin.storage.from('vistorias-fotos').getPublicUrl(f.arquivo_path)
    return {
      id: f.id,
      vistoria_item_id: f.vistoria_item_id,
      url: data.publicUrl,
      origem: f.origem as 'corretor' | 'inquilino',
      legenda: f.legenda,
    }
  })

  // Se a query simples foi quem encontrou (sem join), busca contrato/partes
  // separadamente — evita 404 quando o embed falha por algum motivo.
  type VistoriaComJoin = typeof vistoria & {
    contrato?: { codigo: string; inquilino: unknown; imovel: unknown } | { codigo: string; inquilino: unknown; imovel: unknown }[] | null
  }
  const v = vistoria as VistoriaComJoin
  let contrato = v.contrato ? (Array.isArray(v.contrato) ? v.contrato[0] : v.contrato) : null
  if (!contrato && vistoria.contrato_id) {
    const { data: contratoExtra } = await admin
      .from('contratos_locacao')
      .select(`codigo, inquilino:pessoas!inquilino_id(nome, whatsapp, telefone), imovel:imoveis(titulo)`)
      .eq('id', vistoria.contrato_id)
      .maybeSingle()
    contrato = contratoExtra as typeof contrato
  }
  const inquilino = contrato && (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino) as { nome: string; whatsapp: string | null; telefone: string | null } | null
  const imovel = contrato && (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) as { titulo: string } | null

  const itens: ItemRow[] = (itensRaw ?? []) as ItemRow[]
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto pb-32">
      <div>
        <Link href={`/painel/contratos/${id}/vistorias`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Vistorias
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-violet-600" />
          Vistoria de {vistoria.tipo === 'entrada' ? 'entrada' : 'saída'}
        </h1>
        <p className="text-sm text-gray-500">
          {inquilino?.nome ?? '—'} · {imovel?.titulo ?? '—'} · Contrato {contrato?.codigo}
        </p>
      </div>

      <EditorVistoria
        vistoriaId={vistoriaId}
        contratoId={id}
        status={vistoria.status}
        tipo={vistoria.tipo}
        dataVistoria={vistoria.data_vistoria}
        observacoesGerais={vistoria.observacoes_gerais}
        qtdChaves={vistoria.qtd_chaves ?? 0}
        qtdControles={vistoria.qtd_controles ?? 0}
        token={vistoria.token}
        expiraEm={vistoria.expira_em}
        assinadaEm={vistoria.assinada_em}
        inquilinoObservacoes={vistoria.inquilino_observacoes}
        assinaturaUrl={vistoria.assinatura_inquilino_url}
        whatsappInquilino={inquilino?.whatsapp ?? inquilino?.telefone ?? null}
        nomeInquilino={inquilino?.nome ?? null}
        itens={itens}
        fotos={fotos}
        baseUrl={baseUrl}
      />
    </div>
  )
}
