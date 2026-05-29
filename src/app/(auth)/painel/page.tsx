import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMeusImoveis, getPerfil } from '@/lib/supabase/queries'
import { Plus, Home, LogOut, CheckCircle2, ShieldCheck, AlertCircle, Camera, UserCircle2, ExternalLink, Eye, List } from 'lucide-react'
import { PLANOS } from '@/lib/constants'
import { PlanoActions } from './_components/plano-actions'

async function logout() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/entrar')
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ publicado?: string; atualizado?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const [{ data: imoveis }, { data: perfil }] = await Promise.all([
    getMeusImoveis(user.id),
    getPerfil(user.id),
  ])

  const lista = imoveis ?? []
  const ativos = lista.filter(i => i.status === 'ativo').length

  // Imóveis ativos parados — banner de aviso
  // eslint-disable-next-line react-hooks/purity -- server component dinâmico; data do request
  const agora = Date.now()
  const D30 = 30 * 86400000
  const D60 = 60 * 86400000
  type ImovelLite = { id: string; titulo: string; status: string; updated_at: string; avisos_silenciados_ate?: string | null }
  const ativosComUpdate = (lista as unknown as ImovelLite[]).filter(i =>
    i.status === 'ativo'
    && (!i.avisos_silenciados_ate || new Date(i.avisos_silenciados_ate).getTime() < agora)
  )
  const parados30 = ativosComUpdate.filter(i => {
    const diff = agora - new Date(i.updated_at).getTime()
    return diff >= D30 && diff < D60
  })
  const parados60 = ativosComUpdate.filter(i => agora - new Date(i.updated_at).getTime() >= D60)

  // Indicadores do dashboard
  type ImovelDash = { id: string; status: string; expira_em: string; visualizacoes?: number | null }
  const listaDash = lista as unknown as ImovelDash[]
  const D7 = 7 * 86400000
  const visitasTotais = listaDash.reduce((s, i) => s + (i.visualizacoes ?? 0), 0)
  const aRenovar = listaDash.filter(i => i.status === 'ativo' && (new Date(i.expira_em).getTime() - agora) <= D7).length
  const alugados = listaDash.filter(i => i.status === 'alugado').length
  const totalParados = parados30.length + parados60.length

  const { publicado, atualizado } = await searchParams

  const isAdmin = perfil?.role === 'admin'
  const plano = perfil?.plano ?? 'free'
  const limiteImoveis = PLANOS[plano as keyof typeof PLANOS]?.imoveis ?? 1
  const atingiuLimite = !isAdmin && plano === 'free' && lista.length >= limiteImoveis
  const crmAtivo = !!(perfil as { crm_ativo?: boolean } | null)?.crm_ativo
  const podeUsarCRM = isAdmin || crmAtivo || plano === 'basico' || plano === 'profissional'

  const nomeExibido = perfil?.nome ?? user.email ?? ''
  const iniciais = nomeExibido.split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('')

  const perfilCompleto = !!(perfil?.nome && perfil?.cpf && perfil?.telefone && perfil?.endereco_logradouro)
  const temFoto = !!perfil?.foto_url

  const camposFaltando = [
    !perfil?.nome && 'nome completo',
    !perfil?.cpf && 'CPF',
    !perfil?.telefone && 'telefone',
    !perfil?.endereco_logradouro && 'endereço',
    !temFoto && 'foto de perfil',
  ].filter(Boolean) as string[]

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24">

      {/* Toast publicado / atualizado */}
      {publicado === '1' && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl px-4 py-3.5 mb-6">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <span className="font-medium">Anúncio publicado com sucesso!</span>
        </div>
      )}
      {atualizado === '1' && (
        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-2xl px-4 py-3.5 mb-6">
          <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
          <span className="font-medium">Anúncio atualizado com sucesso!</span>
        </div>
      )}

      {/* Banner anúncios parados */}
      {parados60.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3.5 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">
              {parados60.length} anúncio{parados60.length === 1 ? '' : 's'} parado{parados60.length === 1 ? '' : 's'} há mais de 60 dias
            </p>
            <p className="text-xs text-red-700 mt-0.5 mb-2">
              Anúncios parados perdem ranking na busca. Revise preço/fotos ou pause se já foi alugado.
            </p>
            <ul className="space-y-1">
              {parados60.slice(0, 3).map(im => (
                <li key={im.id} className="text-xs">
                  <Link href={`/painel/anuncios/${im.id}/editar`} className="text-red-800 hover:underline font-medium">
                    {im.titulo} →
                  </Link>
                </li>
              ))}
              {parados60.length > 3 && (
                <li className="text-[11px] text-red-600">+ {parados60.length - 3} outros</li>
              )}
            </ul>
          </div>
        </div>
      )}
      {parados30.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {parados30.length} anúncio{parados30.length === 1 ? '' : 's'} sem atualização há 30+ dias
            </p>
            <p className="text-xs text-amber-700 mt-0.5 mb-2">
              Anúncios atualizados aparecem mais alto na busca. Revise preço, troque alguma foto.
            </p>
            <ul className="space-y-1">
              {parados30.slice(0, 3).map(im => (
                <li key={im.id} className="text-xs">
                  <Link href={`/painel/anuncios/${im.id}/editar`} className="text-amber-800 hover:underline font-medium">
                    {im.titulo} →
                  </Link>
                </li>
              ))}
              {parados30.length > 3 && (
                <li className="text-[11px] text-amber-600">+ {parados30.length - 3} outros</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-xl font-bold text-gray-900">Meu painel</h1>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ExternalLink size={15} />
            Ver site
          </Link>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <LogOut size={15} />
              Sair
            </button>
          </form>
        </div>
      </div>

      {/* Perfil card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar com indicador de foto */}
          <Link href="/painel/perfil" className="shrink-0 relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center border-2 border-violet-200 group-hover:border-violet-400 transition-colors">
              {temFoto
                ? <img src={perfil!.foto_url!} alt={nomeExibido} className="w-full h-full object-cover" />
                : <span className="text-xl font-bold text-violet-600">{iniciais || '?'}</span>
              }
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center border-2 border-white">
              <Camera size={9} className="text-white" />
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="font-bold text-gray-900 truncate">{perfil?.nome ?? 'Sem nome'}</p>
              {isAdmin && <ShieldCheck size={14} className="text-violet-500 shrink-0" />}
            </div>
            <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
            {perfilCompleto ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} />
                Perfil verificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertCircle size={10} />
                Cadastro incompleto
              </span>
            )}
          </div>

          <Link
            href="/painel/perfil"
            className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-800 border border-violet-200 hover:border-violet-400 hover:bg-violet-50 px-3 py-2 rounded-xl transition-colors"
          >
            <UserCircle2 size={15} />
            Editar perfil
          </Link>
        </div>

        {/* Campos faltando */}
        {!perfilCompleto && camposFaltando.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs text-amber-700 font-medium mb-2 flex items-center gap-1">
              <AlertCircle size={11} />
              Complete seu cadastro para publicar anúncios e evitar fraudes:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {camposFaltando.map(campo => (
                <Link
                  key={campo}
                  href="/painel/perfil"
                  className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors capitalize"
                >
                  + {campo}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Link href="/painel/anuncios" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-violet-200 transition-colors">
          <p className="text-2xl font-bold text-gray-900">{lista.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total</p>
        </Link>
        <Link href="/painel/anuncios?status=ativo" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-green-200 transition-colors">
          <p className="text-2xl font-bold text-green-600">{ativos}</p>
          <p className="text-xs text-gray-400 mt-0.5">Ativos</p>
        </Link>
        <Link href="/painel/anuncios?status=alugado" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-teal-200 transition-colors">
          <p className="text-2xl font-bold text-teal-600">{alugados}</p>
          <p className="text-xs text-gray-400 mt-0.5">Alugados</p>
        </Link>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-violet-700 flex items-center justify-center gap-1">
            <Eye size={16} className="text-violet-400" />{visitasTotais.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Visitas totais</p>
        </div>
      </div>

      {/* Ações necessárias */}
      {(aRenovar > 0 || totalParados > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {aRenovar > 0 && (
            <Link href="/painel/anuncios?status=expirado" className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-amber-100 transition-colors">
              <div>
                <p className="text-sm font-semibold text-amber-900">A renovar</p>
                <p className="text-xs text-amber-700">expirando em 7 dias ou já expirados</p>
              </div>
              <span className="text-lg font-bold text-amber-800 bg-amber-200 w-9 h-9 rounded-full flex items-center justify-center shrink-0">{aRenovar}</span>
            </Link>
          )}
          {totalParados > 0 && (
            <Link href="/painel/anuncios?status=ativo" className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-orange-100 transition-colors">
              <div>
                <p className="text-sm font-semibold text-orange-900">Parados 30+ dias</p>
                <p className="text-xs text-orange-700">revise preço/fotos pra subir na busca</p>
              </div>
              <span className="text-lg font-bold text-orange-800 bg-orange-200 w-9 h-9 rounded-full flex items-center justify-center shrink-0">{totalParados}</span>
            </Link>
          )}
        </div>
      )}

      {/* Plano / Admin banner */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-6 flex items-center justify-between gap-3">
        {isAdmin ? (
          <>
            <div>
              <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1">
                <ShieldCheck size={12} /> Administrador
              </span>
              <p className="text-xs text-gray-500 mt-0.5">{lista.length} anúncio{lista.length !== 1 ? 's' : ''} · ilimitado</p>
            </div>
            <Link href="/admin" className="text-xs font-semibold text-violet-700 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors shrink-0">
              Painel admin
            </Link>
          </>
        ) : (
          <>
            <div>
              <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                Plano {PLANOS[plano as keyof typeof PLANOS]?.nome ?? 'Gratuito'}
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                {lista.length}/{limiteImoveis === 999 ? '∞' : limiteImoveis} anúncio{limiteImoveis !== 1 ? 's' : ''}
              </p>
            </div>
            {plano === 'free'
              ? <Link href="/planos" className="text-xs font-semibold text-violet-700 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  Fazer upgrade
                </Link>
              : <PlanoActions plano={plano} />
            }
          </>
        )}
      </div>

      {/* Card CRM (apenas para quem tem acesso) */}
      {podeUsarCRM && (
        <Link
          href="/painel/inicio"
          className="block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-2xl p-5 mb-6 text-white shadow-sm transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">CRM Locação</p>
              <p className="text-xs text-violet-100 mt-0.5">Gerencie contratos, parcelas, recibos e repasses.</p>
            </div>
            <ExternalLink size={18} className="opacity-70" />
          </div>
        </Link>
      )}

      {/* CTA novo anúncio */}
      {atingiuLimite ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8 text-center">
          <p className="text-sm font-semibold text-amber-800 mb-1">Limite do plano gratuito atingido</p>
          <p className="text-xs text-amber-700 mb-3">O plano gratuito permite 1 anúncio ativo. Faça upgrade para publicar mais.</p>
          <Link href="/planos" className="inline-flex items-center gap-1.5 bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-violet-800 transition-colors">
            <Plus size={15} />
            Ver planos
          </Link>
        </div>
      ) : (
        <Link
          href="/painel/anuncios/novo"
          className="flex items-center justify-center gap-2 w-full bg-violet-700 hover:bg-violet-800 active:bg-violet-900 text-white font-semibold py-4 rounded-2xl mb-8 transition-colors"
        >
          <Plus size={18} />
          Publicar novo anúncio
        </Link>
      )}

      {/* Atalho pra lista completa */}
      {lista.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Home size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600 mb-1">Nenhum anúncio ainda</p>
          <p className="text-sm">Publique seu primeiro imóvel e comece a receber contatos.</p>
        </div>
      ) : (
        <Link
          href="/painel/anuncios"
          className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:border-violet-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <List size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Ver todos os anúncios</p>
              <p className="text-xs text-gray-400">Editar, marcar alugado, pausar e renovar</p>
            </div>
          </div>
          <ExternalLink size={16} className="text-gray-300" />
        </Link>
      )}
    </main>
  )
}
