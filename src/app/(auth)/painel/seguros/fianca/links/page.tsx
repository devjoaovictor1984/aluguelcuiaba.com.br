import Link from 'next/link'
import { ArrowLeft, Link2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'
import { GerenciadorLinks } from './_components/gerenciador-links'

export const metadata = { title: 'Links de análise' }

export default async function LinksAnalisePage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)

  const [{ data: links }, { data: imoveis }] = await Promise.all([
    supabase
      .from('seguro_analise_links')
      .select(`
        id, token, titulo, dados_imovel, tipo_analise, expira_em,
        aberto_em, preenchido_em, revogado_em, analise_id, erro, created_at,
        pessoa:pessoas(nome), imovel:imoveis(titulo)
      `)
      .eq('user_id', acesso.userId)
      .eq('produto', 'fianca')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('imoveis')
      .select('id, titulo, preco, endereco_cep, taxa_condominio, iptu, tipo')
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href="/painel/seguros/fianca" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Seguro fiança
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 size={20} className="text-violet-600" /> Links de análise
        </h1>
        <p className="text-sm text-gray-500">
          Mande o link e o inquilino preenche os próprios dados. O cadastro dele
          entra direto na sua carteira.
        </p>
      </div>

      {!perfil.pronto ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-start gap-2.5">
          <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete seu perfil antes de gerar links</p>
            <p className="text-xs text-amber-800 mt-1">
              Falta: <strong>{perfil.faltando?.join(', ')}</strong>.
            </p>
            <Link href="/painel/perfil" className="inline-block mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">
              Completar perfil
            </Link>
          </div>
        </div>
      ) : (
        <GerenciadorLinks
          baseUrl={baseUrl}
          imoveis={(imoveis ?? []).map(i => ({
            id: i.id,
            titulo: i.titulo,
            preco: i.preco,
            cep: i.endereco_cep,
            condominio: i.taxa_condominio,
            iptu: i.iptu,
            tipo: i.tipo,
          }))}
          links={(links ?? []).map(l => ({
            id: l.id,
            url: `${baseUrl}/seguro-fianca/${l.token}`,
            titulo: l.titulo,
            pessoaNome: um<{ nome: string }>(l.pessoa)?.nome ?? null,
            imovelTitulo: um<{ titulo: string }>(l.imovel)?.titulo ?? null,
            aluguel: (l.dados_imovel as { aluguel?: number })?.aluguel ?? null,
            expiraEm: l.expira_em,
            abertoEm: l.aberto_em,
            preenchidoEm: l.preenchido_em,
            revogadoEm: l.revogado_em,
            analiseId: l.analise_id,
            erro: l.erro,
            criadoEm: l.created_at,
          }))}
        />
      )}
    </div>
  )
}
