import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { segurosConfigurado } from '@/lib/seguros/acesso'
import { sessaoAtual } from '@/lib/homologacao/sessao'
import { SidebarPainel } from './_components/sidebar-painel'
import { BotaoSugestao } from './_components/botao-sugestao'
import { BarraApontamento } from './_components/barra-apontamento'

async function logoutAction() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/entrar')
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, foto_url, plano, role, banido_em')
    .eq('id', user.id)
    .single()

  // Conta suspensa: redireciona pra /banido (que faz signOut + mostra motivo).
  if (perfil?.banido_em) redirect('/banido')

  // Convidado da corretora. A sessão é reconferida no banco: revogar ou
  // vencer corta o acesso na hora, sem esperar o cookie expirar.
  const ehHomologacao = perfil?.role === 'homologacao'
  const sessao = ehHomologacao ? await sessaoAtual() : null
  if (ehHomologacao && !sessao) redirect('/homologacao/encerrada?motivo=expirada')

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarPainel
        userNome={sessao ? sessao.nome : perfil?.nome ?? null}
        userEmail={user.email ?? ''}
        fotoUrl={perfil?.foto_url ?? null}
        plano={perfil?.plano ?? 'free'}
        isAdmin={perfil?.role === 'admin'}
        // Server component lê a env; o menu recebe só o booleano.
        segurosLigado={segurosConfigurado()}
        homologacao={ehHomologacao}
        logoutAction={logoutAction}
      />
      <div className="lg:pl-60">
        {children}
      </div>
      {/* O convidado anota; o corretor sugere. Nunca os dois. */}
      {sessao
        ? <BarraApontamento expiraEm={sessao.expiraEm} />
        : <BotaoSugestao />}
    </div>
  )
}
