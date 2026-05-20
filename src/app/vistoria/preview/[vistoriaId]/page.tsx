import { ClipboardCheck, Eye, AlertOctagon } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { VistoriaInquilino, type ItemPub, type FotoPub } from '../../[token]/_components/vistoria-inquilino'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ vistoriaId: string }>
}

export default async function VistoriaPreviewPage({ params }: Props) {
  const { vistoriaId } = await params
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  // Valida posse — só o dono pode prever
  const { data: vistoria } = await supabase
    .from('vistorias')
    .select('id, user_id, tipo, status, data_vistoria, observacoes_gerais, qtd_chaves, qtd_controles, contrato_id')
    .eq('id', vistoriaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!vistoria) {
    return (
      <main className="min-h-screen bg-gray-50 py-20 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertOctagon size={28} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Vistoria não encontrada</h1>
          <p className="text-sm text-gray-500">Ou não é sua. Volte ao painel.</p>
        </div>
      </main>
    )
  }

  const { data: perfil } = await admin
    .from('perfis').select('nome').eq('id', acesso.userId).maybeSingle()
  const nomeAnunciante = perfil?.nome ?? 'AluguelCuiabá'

  const { data: itensRaw } = await supabase
    .from('vistoria_itens')
    .select('id, comodo, item, estado, observacao, observacao_inquilino, ordem')
    .eq('vistoria_id', vistoriaId)
    .order('ordem', { ascending: true })

  const { data: fotosRaw } = await supabase
    .from('vistoria_fotos')
    .select('id, vistoria_item_id, comodo, arquivo_path, origem, legenda')
    .eq('vistoria_id', vistoriaId)
    .order('created_at', { ascending: true })

  const fotos: FotoPub[] = ((fotosRaw ?? []) as Array<{
    id: string; vistoria_item_id: string | null; comodo: string | null
    arquivo_path: string; origem: string; legenda: string | null
  }>).map(f => {
    const { data } = admin.storage.from('vistorias-fotos').getPublicUrl(f.arquivo_path)
    return {
      id: f.id,
      vistoria_item_id: f.vistoria_item_id,
      url: data.publicUrl,
      origem: f.origem as 'corretor' | 'inquilino',
      legenda: f.legenda,
    }
  })

  const itens: ItemPub[] = (itensRaw ?? []) as ItemPub[]

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Banner de preview */}
        <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-3 mb-4 flex items-start gap-2">
          <Eye size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900">
            <p className="font-bold mb-0.5">Modo pré-visualização</p>
            <p>Você está vendo a vistoria como o inquilino verá. <strong>Nada nesta tela é salvo</strong> — observações, fotos e assinatura aqui são só pra teste.</p>
          </div>
          <Link
            href={`/painel/contratos/${vistoria.contrato_id}/vistorias/${vistoriaId}`}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded shrink-0"
          >
            Voltar
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-100">
              <ClipboardCheck size={14} /> {nomeAnunciante}
            </div>
            <h1 className="text-xl font-bold mt-1">
              Vistoria de {vistoria.tipo === 'entrada' ? 'entrada' : 'saída'}
            </h1>
            <p className="text-sm text-violet-100 mt-1">
              Revise cada item, adicione observação ou foto se algo não estiver correto, e assine no final.
            </p>
            {vistoria.data_vistoria && (
              <p className="text-xs text-violet-200 mt-2">
                Data da vistoria: {new Date(vistoria.data_vistoria + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          <div className="p-5">
            <VistoriaInquilino
              token="preview"
              tipo={vistoria.tipo as 'entrada' | 'saida'}
              observacoesGerais={vistoria.observacoes_gerais}
              qtdChaves={vistoria.qtd_chaves ?? 0}
              qtdControles={vistoria.qtd_controles ?? 0}
              itens={itens}
              fotos={fotos}
              previewMode
            />
          </div>
        </div>

        <p className="text-center text-[11px] text-amber-700 mt-4 font-semibold">
          🧪 Esta é uma pré-visualização. O inquilino real vai abrir um link único.
        </p>
      </div>
    </main>
  )
}
