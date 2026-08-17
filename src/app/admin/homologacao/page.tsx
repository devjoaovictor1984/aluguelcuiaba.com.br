import { createAdminClient } from '@/lib/supabase/admin'
import { PainelHomologacao } from './_components/painel-homologacao'

export const metadata = { title: 'Homologação — admin' }
export const dynamic = 'force-dynamic'

/**
 * Onde a sessão de homologação vira trabalho.
 *
 * A leitura que interessa não é "quantas anotações" — é quais ainda não
 * foram tratadas e o que estava acontecendo na tela quando cada uma foi
 * escrita. Por isso o apontamento desce inteiro para o cliente, com
 * contexto e eventos: é ali que se vê o payload sem precisar reproduzir.
 */
export default async function AdminHomologacaoPage() {
  const admin = createAdminClient()

  const [{ data: sessoes }, { data: apontamentos }] = await Promise.all([
    admin
      .from('sessoes_homologacao')
      .select('id, nome, organizacao, observacao, token, expira_em, revogada_em, primeiro_acesso_em, ultimo_acesso_em, acessos, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('homologacao_apontamentos')
      .select('id, sessao_id, tipo, titulo, detalhe, contexto, eventos, resolvido_em, resolucao, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <PainelHomologacao
      sessoes={(sessoes ?? []).map(s => ({
        id: s.id,
        nome: s.nome,
        organizacao: s.organizacao,
        observacao: s.observacao,
        token: s.token,
        expiraEm: s.expira_em,
        revogadaEm: s.revogada_em,
        primeiroAcessoEm: s.primeiro_acesso_em,
        ultimoAcessoEm: s.ultimo_acesso_em,
        acessos: s.acessos ?? 0,
        criadaEm: s.created_at,
      }))}
      apontamentos={(apontamentos ?? []).map(a => ({
        id: a.id,
        sessaoId: a.sessao_id,
        tipo: a.tipo,
        titulo: a.titulo,
        detalhe: a.detalhe,
        contexto: a.contexto,
        eventos: a.eventos,
        resolvidoEm: a.resolvido_em,
        resolucao: a.resolucao,
        criadoEm: a.created_at,
      }))}
      baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.aluguelcuiaba.com.br'}
    />
  )
}
