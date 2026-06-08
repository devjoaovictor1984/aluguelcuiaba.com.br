import Link from 'next/link'
import { ArrowLeft, KeyRound, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { EditorTermo } from './_components/editor-termo'

interface Props {
  params: Promise<{ id: string; termoId: string }>
}

export default async function TermoPage({ params }: Props) {
  const { id, termoId } = await params
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: termo } = await supabase
    .from('termos_entrega_chaves')
    .select('*')
    .eq('id', termoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!termo) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link href={`/painel/contratos/${id}/termo-chaves`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Termos de chaves
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h1 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertOctagon size={18} /> Termo não encontrado
          </h1>
          <p className="text-sm text-amber-900">Este termo não existe ou pertence a outra conta.</p>
        </div>
      </div>
    )
  }

  const { data: perfil } = await admin
    .from('perfis')
    .select('nome, razao_social, creci, creci_juridico')
    .eq('id', acesso.userId)
    .maybeSingle()

  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select('codigo, inquilino:pessoas!inquilino_id(nome, whatsapp, telefone), imovel:imoveis(titulo)')
    .eq('id', termo.contrato_id)
    .maybeSingle()
  const inquilino = contrato && (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino) as { nome: string; whatsapp: string | null; telefone: string | null } | null
  const imovel = contrato && (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) as { titulo: string } | null

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // URLs públicas das selfies/assinaturas já vêm prontas (bucket público).
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href={`/painel/contratos/${id}/termo-chaves`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Termos de chaves
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <KeyRound size={20} className="text-violet-600" /> Termo de entrega de chaves
        </h1>
        <p className="text-sm text-gray-500">
          {inquilino?.nome ?? '—'} · {imovel?.titulo ?? '—'} · Contrato {contrato?.codigo}
        </p>
      </div>

      <EditorTermo
        termoId={termoId}
        contratoId={id}
        status={termo.status}
        dataEntrega={termo.data_entrega}
        qtdChaves={termo.qtd_chaves_entregues ?? 0}
        qtdControles={termo.qtd_controles_entregues ?? 0}
        estadoEntrega={termo.estado_entrega}
        observacoes={termo.observacoes}
        token={termo.token}
        expiraEm={termo.expira_em}
        enviadaEm={termo.enviada_em}
        recusadaMotivo={termo.recusada_motivo}
        assinadoLocatarioEm={termo.assinado_locatario_em}
        assinaturaLocatarioUrl={termo.assinatura_locatario_url}
        selfieLocatarioUrl={termo.selfie_locatario_url}
        observacoesLocatario={termo.observacoes_locatario}
        assinadoLocadorEm={termo.assinado_locador_em}
        assinaturaLocadorUrl={termo.assinatura_locador_url}
        selfieLocadorUrl={termo.selfie_locador_url}
        whatsappInquilino={inquilino?.whatsapp ?? inquilino?.telefone ?? null}
        nomeInquilino={inquilino?.nome ?? null}
        imobiliariaNome={perfil?.razao_social ?? perfil?.nome ?? null}
        corretorNome={perfil?.nome ?? null}
        corretorCreci={perfil?.creci ?? null}
        creciJuridico={perfil?.creci_juridico ?? null}
        temRazaoSocial={!!perfil?.razao_social}
        baseUrl={baseUrl}
      />
    </div>
  )
}
