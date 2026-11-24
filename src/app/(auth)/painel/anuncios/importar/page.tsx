import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Download, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NovaImportacao } from './_components/nova-importacao'
import { FonteSalva } from './_components/fonte-salva'
import { HistoricoImportacoes, type LinhaHistorico } from './_components/historico'

export const dynamic = 'force-dynamic'
// A análise de um XML grande roda numa server action desta página.
export const maxDuration = 300

/**
 * Importar anúncios de outro sistema (XML VRSync / ZAP). O caminho de
 * volta dos Portais. Ver docs/integracoes/importacao/README.md.
 */
export default async function ImportarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const db = createAdminClient()
  const [{ data: fontes, error }, { data: historico }] = await Promise.all([
    db.from('importacoes_fontes')
      .select('id, nome, url, sincronizar, opcoes, ultima_sincronizacao_em, ultimo_erro, criado_em')
      .eq('user_id', user.id).order('criado_em', { ascending: false }),
    db.from('importacoes')
      .select('id, origem, url, arquivo_nome, status, resumo, total, criado_em, concluido_em, automatica, erro')
      .eq('user_id', user.id).order('criado_em', { ascending: false }).limit(30),
  ])

  if (error && /importacoes/.test(error.message)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          <p className="font-semibold mb-1">Falta rodar a migration v108 no Supabase</p>
          <p>Arquivo: <code>supabase/migrations/crm_v108_importacao_xml.sql</code>. Depois disso esta tela liga sozinha.</p>
        </div>
      </main>
    )
  }

  const andamento = (historico ?? []).find(h => h.status === 'importando')

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 pb-24">
      <Link href="/painel/anuncios" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Meus anúncios
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Download size={22} className="text-violet-600" /> Importar anúncios
      </h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-5">
        Traga os imóveis de aluguel de outro sistema pelo XML que ele já gera para o ZAP, Viva Real e OLX.
      </p>

      <details className="bg-violet-50/60 ring-1 ring-violet-100 rounded-2xl p-4 mb-5 text-sm text-gray-700 group" open={!historico?.length}>
        <summary className="font-semibold text-violet-900 cursor-pointer flex items-center gap-2">
          <Info size={15} /> Como funciona
        </summary>
        <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-[13px]">
          <li>Peça ao sistema da imobiliária a <strong>URL do XML que vai para o ZAP/Viva Real</strong> (padrão VRSync), ou baixe o arquivo. Formato antigo do ZAP também serve.</li>
          <li>Cole a URL (ou envie o arquivo). Sai uma <strong>prévia</strong>: o que vem, o que fica de fora (venda, temporada, outra cidade) e os bairros que não reconhecemos — você escolhe o bairro certo uma vez e fica salvo.</li>
          <li>Confirme. Os imóveis entram como <strong>rascunho</strong> (ou já publicados, se você marcar), com as fotos copiadas para cá.</li>
          <li>Importar de novo <strong>atualiza</strong> em vez de duplicar. O que você editou aqui não é sobrescrito, a não ser que marque.</li>
          <li>Com a URL salva, dá para ligar a <strong>atualização automática</strong> (todo dia de madrugada).</li>
        </ol>
        <p className="text-[12px] text-gray-500 mt-3">
          Não vem pelo XML: proprietário, contrato, chaves e vídeos. Características sem campo aqui (elevador, academia…) entram no texto do anúncio.
          Se o sistema antigo continuar mandando estes imóveis para o Canal Pro, <strong>não ligue os mesmos nos Portais daqui</strong> — o portal recusa duplicado.
        </p>
      </details>

      <NovaImportacao desabilitado={andamento ? 'Tem uma importação em andamento. Abra ela abaixo para continuar ou cancelar.' : null} />

      {!!fontes?.length && (
        <section className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">URLs salvas</h2>
          <ul className="space-y-2">
            {fontes.map(f => (
              <FonteSalva
                key={f.id}
                id={f.id}
                nome={f.nome}
                url={f.url}
                sincronizar={f.sincronizar}
                pausarAusentes={!!(f.opcoes as { pausarAusentes?: boolean } | null)?.pausarAusentes}
                ultima={f.ultima_sincronizacao_em}
                ultimoErro={f.ultimo_erro}
                bloqueado={!!andamento}
              />
            ))}
          </ul>
        </section>
      )}

      <HistoricoImportacoes linhas={(historico ?? []) as LinhaHistorico[]} />
    </main>
  )
}
