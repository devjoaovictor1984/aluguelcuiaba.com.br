import Link from 'next/link'
import { FileText, User, Crown, Shield, Plus, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface ParteInfo {
  id: string
  nome: string
  papel: 'inquilino' | 'proprietario' | 'fiador'
}

interface Props {
  userId: string
  partes: ParteInfo[]
}

interface DocLite {
  id: string
  pessoa_id: string
  tipo: string
  nome_original: string
  created_at: string
}

const ICONE_PAPEL = {
  inquilino: User,
  proprietario: Crown,
  fiador: Shield,
} as const

const LABEL_PAPEL = {
  inquilino: 'Inquilino',
  proprietario: 'Proprietário',
  fiador: 'Fiador',
} as const

const LABEL_TIPO: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', cnh: 'CNH', passaporte: 'Passaporte',
  comprovante_renda: 'Comprovante de renda',
  comprovante_residencia: 'Comprovante de residência',
  contracheque: 'Contracheque', extrato_bancario: 'Extrato',
  imposto_renda: 'IR', certidao_casamento: 'Cert. casamento',
  certidao_nascimento: 'Cert. nascimento', foto: 'Foto', outro: 'Outro',
}

export async function DocsPartesContrato({ userId, partes }: Props) {
  if (partes.length === 0) return null

  const supabase = await createClient()
  const ids = partes.map(p => p.id)

  const { data: docsRaw } = await supabase
    .from('pessoas_documentos')
    .select('id, pessoa_id, tipo, nome_original, created_at')
    .eq('user_id', userId)
    .in('pessoa_id', ids)
    .order('created_at', { ascending: false })

  const docs: DocLite[] = (docsRaw ?? []) as DocLite[]
  const porPessoa: Record<string, DocLite[]> = {}
  for (const d of docs) {
    if (!porPessoa[d.pessoa_id]) porPessoa[d.pessoa_id] = []
    porPessoa[d.pessoa_id].push(d)
  }

  const totalDocs = docs.length

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={15} className="text-violet-600" /> Documentos das partes
          <span className="text-xs text-gray-400 font-normal">({totalDocs})</span>
        </h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {partes.map(parte => {
          const Icon = ICONE_PAPEL[parte.papel]
          const lista = porPessoa[parte.id] ?? []
          return (
            <div key={parte.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
                    <Icon size={10} /> {LABEL_PAPEL[parte.papel]}
                  </p>
                  <p className="text-sm font-medium text-gray-900 truncate">{parte.nome}</p>
                </div>
                <Link
                  href={`/painel/clientes/${parte.id}`}
                  title="Abrir cadastro + upload"
                  className="text-violet-600 hover:text-violet-800 shrink-0 p-1"
                >
                  <ExternalLink size={12} />
                </Link>
              </div>

              {lista.length === 0 ? (
                <Link
                  href={`/painel/clientes/${parte.id}`}
                  className="flex items-center justify-center gap-1.5 w-full text-xs text-gray-400 hover:text-violet-700 border border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-lg py-2.5 transition-colors"
                >
                  <Plus size={11} /> Adicionar documento
                </Link>
              ) : (
                <ul className="space-y-1">
                  {lista.slice(0, 6).map(d => (
                    <li key={d.id}>
                      <Link
                        href={`/painel/clientes/${parte.id}`}
                        className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-violet-700 bg-gray-50 hover:bg-violet-50 rounded-lg px-2 py-1.5 transition-colors"
                        title={d.nome_original}
                      >
                        <FileText size={10} className="text-gray-400 shrink-0" />
                        <span className="truncate font-medium">{LABEL_TIPO[d.tipo] ?? d.tipo}</span>
                      </Link>
                    </li>
                  ))}
                  {lista.length > 6 && (
                    <li>
                      <Link
                        href={`/painel/clientes/${parte.id}`}
                        className="text-[11px] text-violet-700 hover:underline px-2"
                      >
                        + {lista.length - 6} mais
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        💡 Para subir/remover documentos, clique no nome da pessoa ou use o botão ↗. Para pedir docs sem que a pessoa precise fazer login, gere um link em "Pedir atualização" dentro do cadastro do cliente.
      </p>
    </section>
  )
}
