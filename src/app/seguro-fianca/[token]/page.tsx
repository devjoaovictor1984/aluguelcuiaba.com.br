import { ShieldCheck, AlertOctagon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatarBRL } from '@/lib/formatters'
import { FormPretendente } from './_components/form-pretendente'

interface Props {
  params: Promise<{ token: string }>
}

/** Fora do componente: `Date.now()` no corpo do render viola react-hooks/purity. */
function expirou(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

export const metadata = {
  title: 'Análise de seguro fiança',
  robots: { index: false, follow: false },
}

export default async function SeguroFiancaLinkPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('seguro_analise_links')
    .select('id, user_id, dados_imovel, tipo_analise, titulo, mensagem, expira_em, preenchido_em, revogado_em, imovel:imoveis(titulo, endereco_resumido)')
    .eq('token', token)
    .maybeSingle()

  if (!link) return <Aviso tipo="erro" titulo="Link inválido" texto="Esse endereço não existe ou foi removido." />
  if (link.revogado_em) return <Aviso tipo="erro" titulo="Link cancelado" texto="O corretor cancelou esta solicitação. Entre em contato com ele." />
  if (link.preenchido_em) {
    return (
      <Aviso
        tipo="ok"
        titulo="Formulário já enviado"
        texto="Recebemos seus dados. O corretor entra em contato assim que a seguradora responder."
      />
    )
  }
  if (expirou(link.expira_em)) {
    return <Aviso tipo="erro" titulo="Link expirado" texto="Esse link passou da validade. Peça um novo ao corretor." />
  }

  const { data: perfil } = await admin
    .from('perfis')
    .select('nome, razao_social, creci, creci_juridico, foto_url')
    .eq('id', link.user_id)
    .maybeSingle()

  const corretor = perfil?.razao_social ?? perfil?.nome ?? 'AluguelCuiabá'
  const creci = perfil?.creci_juridico ?? perfil?.creci ?? null

  const imovel = Array.isArray(link.imovel) ? link.imovel[0] : link.imovel
  const dados = link.dados_imovel as { aluguel?: number; cep?: string }

  return (
    <main className="min-h-dvh bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <header className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-700 text-white flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">
            {link.titulo ?? 'Análise de seguro fiança'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Solicitado por <strong>{corretor}</strong>
            {creci && <> · CRECI {creci}</>}
          </p>
        </header>

        {link.mensagem && (
          <p className="text-sm text-violet-900 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            {link.mensagem}
          </p>
        )}

        {(imovel?.titulo || dados.aluguel) && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Imóvel</p>
            {imovel?.titulo && <p className="text-sm text-gray-900">{imovel.titulo}</p>}
            {imovel?.endereco_resumido && <p className="text-xs text-gray-500">{imovel.endereco_resumido}</p>}
            {dados.aluguel != null && (
              <p className="text-sm font-semibold text-violet-700 mt-1">
                Aluguel {formatarBRL(Number(dados.aluguel))}
              </p>
            )}
          </div>
        )}

        <FormPretendente token={token} completa={link.tipo_analise === 'completa'} />

        <p className="text-[11px] text-gray-400 text-center leading-relaxed pb-6">
          Seus dados são enviados à corretora e às seguradoras parceiras apenas
          para análise do seguro fiança deste imóvel.
        </p>
      </div>
    </main>
  )
}

function Aviso({ tipo, titulo, texto }: { tipo: 'ok' | 'erro'; titulo: string; texto: string }) {
  const ok = tipo === 'ok'
  return (
    <main className="min-h-dvh bg-gray-50 flex items-center justify-center px-4">
      <div className={`max-w-md w-full rounded-2xl border p-6 text-center ${
        ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex justify-center mb-3">
          {ok
            ? <ShieldCheck size={26} className="text-green-600" />
            : <AlertOctagon size={26} className="text-amber-600" />}
        </div>
        <h1 className={`text-lg font-bold mb-1 ${ok ? 'text-green-900' : 'text-amber-900'}`}>{titulo}</h1>
        <p className={`text-sm ${ok ? 'text-green-800' : 'text-amber-800'}`}>{texto}</p>
      </div>
    </main>
  )
}
