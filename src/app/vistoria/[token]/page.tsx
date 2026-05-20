import { AlertOctagon, CheckCircle2, ClipboardCheck } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { VistoriaInquilino, type ItemPub, type FotoPub } from './_components/vistoria-inquilino'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function VistoriaPublicaPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: vistoria } = await admin
    .from('vistorias')
    .select(`
      id, user_id, tipo, status, data_vistoria, observacoes_gerais,
      qtd_chaves, qtd_controles, enviada_em, expira_em,
      assinada_em, assinatura_inquilino_url, inquilino_observacoes
    `)
    .eq('token', token)
    .maybeSingle()

  if (!vistoria) return <Erro titulo="Link inválido" mensagem="Esse link de vistoria não existe ou foi removido." />
  if (vistoria.status === 'recusada') return <Erro titulo="Vistoria recusada" mensagem="Você já recusou essa vistoria. Entre em contato com o anunciante." />
  if (vistoria.status === 'assinada') {
    const quando = vistoria.assinada_em ? new Date(vistoria.assinada_em).toLocaleString('pt-BR') : '—'
    return (
      <Sucesso
        titulo="Vistoria já assinada"
        mensagem={`Você assinou essa vistoria em ${quando}. Pode fechar a página.`}
      />
    )
  }
  if (vistoria.status !== 'enviada') return <Erro titulo="Indisponível" mensagem="Esta vistoria ainda está em rascunho. Peça pro responsável enviar novamente." />
  if (vistoria.expira_em && new Date(vistoria.expira_em).getTime() < Date.now()) {
    return <Erro titulo="Link expirado" mensagem="Esse link passou da validade. Peça um novo." />
  }

  // Anunciante
  const { data: perfil } = await admin.from('perfis').select('nome').eq('id', vistoria.user_id).maybeSingle()
  const nomeAnunciante = perfil?.nome ?? 'AluguelCuiabá'

  // Itens
  const { data: itensRaw } = await admin
    .from('vistoria_itens')
    .select('id, comodo, item, estado, observacao, observacao_inquilino, ordem')
    .eq('vistoria_id', vistoria.id)
    .order('ordem', { ascending: true })

  // Fotos com URL pública
  const { data: fotosRaw } = await admin
    .from('vistoria_fotos')
    .select('id, vistoria_item_id, arquivo_path, origem, legenda')
    .eq('vistoria_id', vistoria.id)
    .order('created_at', { ascending: true })

  const fotos: FotoPub[] = (fotosRaw ?? []).map(f => {
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
              token={token}
              tipo={vistoria.tipo}
              observacoesGerais={vistoria.observacoes_gerais}
              qtdChaves={vistoria.qtd_chaves ?? 0}
              qtdControles={vistoria.qtd_controles ?? 0}
              itens={itens}
              fotos={fotos}
            />
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Vistoria gerada via AluguelCuiabá. Sua assinatura digital é registrada com data, hora e IP.
        </p>
      </div>
    </main>
  )
}

function Erro({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertOctagon size={28} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500">{mensagem}</p>
      </div>
    </main>
  )
}

function Sucesso({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500">{mensagem}</p>
      </div>
    </main>
  )
}
