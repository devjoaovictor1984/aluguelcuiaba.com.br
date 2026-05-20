import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { EditorVistoria, type ItemRow, type FotoRow } from './_components/editor-vistoria'

interface Props {
  params: Promise<{ id: string; vistoriaId: string }>
}

export default async function VistoriaPage({ params }: Props) {
  const { id, vistoriaId } = await params
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: vistoria } = await supabase
    .from('vistorias')
    .select(`*, contrato:contratos_locacao!inner(codigo, inquilino:pessoas!inquilino_id(nome, whatsapp, telefone), imovel:imoveis(titulo))`)
    .eq('id', vistoriaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!vistoria) notFound()

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

  const contrato = Array.isArray(vistoria.contrato) ? vistoria.contrato[0] : vistoria.contrato
  const inquilino = contrato && (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino)
  const imovel = contrato && (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel)

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
