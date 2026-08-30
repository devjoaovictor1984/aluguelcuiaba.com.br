import Link from 'next/link'
import { ShieldCheck, Plus, Search, AlertTriangle, FlaskConical, Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'
import { STATUS_RESUMO_COR, STATUS_RESUMO_LABEL } from '@/lib/seguros/status-ui'
import { identificarPretendente } from '@/lib/seguros/pretendente'
import { formatarBRL, maskCpfCnpj } from '@/lib/formatters'
import { Paginacao } from '../_components/paginacao'
import { BuscaSeguros } from '../_components/busca-seguros'
import { BandeiraSeguradora } from '../_components/bandeira-seguradora'
import { AvisoDemo } from '../_components/aviso-demo'
import { FaixaAmbiente } from '../_components/faixa-ambiente'

const POR_PAGINA = 20

interface Props {
  searchParams: Promise<{ q?: string; status?: string; p?: string }>
}

export const metadata = { title: 'Seguro fiança' }

export default async function SeguroFiancaPage({ searchParams }: Props) {
  const acesso = await exigirAcessoSeguros()
  const { q, status, p } = await searchParams
  const pagina = Math.max(1, parseInt(p ?? '1', 10) || 1)

  const supabase = await createClient()
  const admin = createAdminClient()

  // Avisa antes de o corretor preencher a análise inteira e só então
  // descobrir que falta dado no cadastro dele.
  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)

  let query = supabase
    .from('seguro_analises')
    .select(
      `id, maximiza_id, status_resumo, ambiente, tipo_analise, finalidade,
       valor_aluguel, created_at, erro, origem, payload,
       inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
       imovel:imoveis(titulo),
       contrato:contratos_locacao(codigo),
       pareceres:seguro_analise_pareceres(seguradora_sigla, codigo_status)`,
      { count: 'exact' },
    )
    .eq('user_id', acesso.userId)
    .eq('produto', 'fianca')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status_resumo', status)

  const { data, count } = await query
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

  type Linha = {
    id: string
    maximiza_id: number | null
    status_resumo: string
    ambiente: number
    tipo_analise: string
    finalidade: string
    valor_aluguel: number | null
    created_at: string
    erro: string | null
    origem: string
    payload: unknown
    inquilino: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
    imovel: { titulo: string } | { titulo: string }[] | null
    contrato: { codigo: string } | { codigo: string }[] | null
    pareceres: { seguradora_sigla: string; codigo_status: number | null }[] | null
  }

  const um = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v

  // A busca por nome/CPF do inquilino é feita aqui porque o termo cai numa
  // tabela relacionada — filtrar no banco exigiria uma view.
  const termo = q?.trim().toLowerCase() ?? ''
  const lista = ((data ?? []) as Linha[]).filter(l => {
    if (!termo) return true
    // Busca pelo mesmo nome que a tela mostra: quem cotou sem cadastro
    // também precisa ser encontrável.
    const pret = identificarPretendente(um(l.inquilino), l.payload)
    const alvo = [
      pret.nome, pret.cpfCnpj, um(l.contrato)?.codigo,
      um(l.imovel)?.titulo, l.maximiza_id,
    ].filter(Boolean).join(' ').toLowerCase()
    return alvo.includes(termo)
  })

  const total = count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto pb-24">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-violet-600" /> Seguro fiança
          </h1>
          <p className="text-sm text-gray-500">
            Cotação em paralelo nas seguradoras parceiras.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/painel/seguros/fianca/links"
            className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl"
          >
            <Link2 size={15} /> Gerar link
          </Link>
          <Link
            href="/painel/seguros/fianca/nova"
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
          >
            <Plus size={15} /> Nova cotação
          </Link>
        </div>
      </div>

      <FaixaAmbiente />
      <AvisoDemo />

      {!perfil.pronto && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete seu perfil pra cotar</p>
            <p className="text-xs text-amber-800 mt-0.5">
              A seguradora exige: {perfil.faltando?.join(', ')}.{' '}
              <Link href="/painel/perfil" className="underline font-medium">Editar perfil</Link>
            </p>
          </div>
        </div>
      )}

      <BuscaSeguros q={q} status={status} base="/painel/seguros/fianca" />

      {lista.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
          <Search size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {q || status ? 'Nenhuma cotação com esse filtro.' : 'Nenhuma cotação ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(l => {
            const pret = identificarPretendente(um(l.inquilino), l.payload)
            const contrato = um(l.contrato)
            const imovel = um(l.imovel)
            return (
              <Link
                key={l.id}
                href={`/painel/seguros/fianca/${l.id}`}
                className="block bg-white ring-1 ring-gray-100 rounded-2xl shadow-sm px-4 py-3.5 active:bg-gray-50 hover:ring-violet-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                      {pret.nome ?? 'Cotação sem nome'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {imovel?.titulo ?? (pret.cpfCnpj ? maskCpfCnpj(pret.cpfCnpj) : '—')}
                      {contrato?.codigo && <> · {contrato.codigo}</>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      STATUS_RESUMO_COR[l.status_resumo] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {STATUS_RESUMO_LABEL[l.status_resumo] ?? l.status_resumo}
                    </span>
                    {/* Homologação não emite apólice — precisa ficar óbvio. */}
                    {l.ambiente === 2 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <FlaskConical size={9} /> teste
                      </span>
                    )}
                  </div>
                </div>

                {/* Bandeiras: quem respondeu o quê, numa olhada */}
                {!!l.pareceres?.length && (
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {l.pareceres.map(p => (
                      <BandeiraSeguradora
                        key={p.seguradora_sigla}
                        sigla={p.seguradora_sigla}
                        status={p.codigo_status}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-baseline justify-between gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                  <p className="text-[11px] text-gray-400 truncate">
                    {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    {l.maximiza_id && <> · nº {l.maximiza_id}</>}
                    {l.origem === 'link' && <> · via link</>}
                    {l.finalidade === 'C' && <> · comercial</>}
                  </p>
                  {l.valor_aluguel != null && (
                    <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">
                      {formatarBRL(l.valor_aluguel)}
                    </p>
                  )}
                </div>

                {l.erro && (
                  <p className="text-[11px] text-rose-600 mt-1.5 line-clamp-1">{l.erro}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <Paginacao
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        base="/painel/seguros/fianca"
        params={{ q, status }}
      />
    </div>
  )
}
