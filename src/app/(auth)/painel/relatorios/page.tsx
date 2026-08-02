import { FileText, User, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { STATUS_CANCELADA } from '@/lib/crm/encerramento'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { FiltrosRelatorio } from './_components/filtros'

interface Props {
  searchParams: Promise<{ tipo?: string; pessoa?: string; ano?: string }>
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface ParcelaRow {
  id: string
  numero: number
  contrato_id: string
  mes_referencia: string
  vencimento: string
  data_pagamento: string | null
  valor_total: number
  valor_aluguel: number
  valor_seguro: number
  valor_iptu: number
  valor_condominio: number
  valor_comissao: number
  valor_repasse_proprietario: number
  valor_pago: number | null
  juros_multa: number | null
  desconto: number | null
  status_pagamento: string
  status_repasse: string
  contrato: {
    id: string
    codigo: string
    inquilino_id: string
    proprietario_id: string
    inquilino: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
    proprietario: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
    imovel: { titulo: string; endereco_resumido: string | null; bairro: { nome: string } | { nome: string }[] | null } | { titulo: string; endereco_resumido: string | null; bairro: { nome: string } | { nome: string }[] | null }[] | null
  } | { id: string; codigo: string; inquilino_id: string; proprietario_id: string; inquilino: unknown; proprietario: unknown; imovel: unknown }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function RelatoriosPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const sp = await searchParams
  const tipo = sp.tipo === 'proprietario' ? 'proprietario' : 'inquilino'
  const pessoaId = sp.pessoa ?? ''
  const ano = parseInt(sp.ano ?? '') || new Date().getFullYear()
  const inicioAno = `${ano}-01-01`
  const fimAno = `${ano}-12-31`

  // Pessoas pra seletor
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('id, nome, tipo')
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .in('tipo', ['inquilino', 'proprietario'])
    .order('nome', { ascending: true })

  // Perfil pro header do relatório
  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, cpf, telefone')
    .eq('id', acesso.userId)
    .single()

  // Se sem pessoa selecionada, só mostra filtros
  if (!pessoaId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <FileText size={20} className="text-violet-600" /> Relatórios anuais
        </h1>
        <FiltrosRelatorio pessoas={pessoas ?? []} tipo={tipo} pessoaId={pessoaId} ano={ano} />

        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <FileText size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Extrato por cliente</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Selecione um <strong>inquilino</strong> pra ver tudo que ele pagou no ano (com juros, descontos e datas),
            ou um <strong>proprietário</strong> pra ver os repasses recebidos no período.
          </p>
        </div>
      </div>
    )
  }

  // Busca dados da pessoa selecionada
  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('id, nome, cpf_cnpj, telefone, email, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado')
    .eq('id', pessoaId)
    .eq('user_id', acesso.userId)
    .single()

  // Busca parcelas: do inquilino (todas) ou do proprietário, dentro do ano
  // Filtro de tempo:
  //  - inquilino: data_pagamento dentro do ano (regime de caixa)
  //  - proprietário: data_pagamento dentro do ano também
  // Caso queira ver tb não pagas:
  //  - inquilino: mes_referencia do ano
  const colunaPessoa = tipo === 'inquilino' ? 'inquilino_id' : 'proprietario_id'

  const { data: parcelasRaw } = await supabase
    .from('parcelas_aluguel')
    .select(`
      id, numero, contrato_id, mes_referencia, vencimento, data_pagamento,
      valor_total, valor_aluguel, valor_seguro, valor_iptu, valor_condominio,
      valor_comissao, valor_repasse_proprietario, valor_pago, juros_multa, desconto,
      status_pagamento, status_repasse,
      contrato:contratos_locacao!inner(
        id, codigo, inquilino_id, proprietario_id,
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
        proprietario:pessoas!proprietario_id(nome, cpf_cnpj),
        imovel:imoveis(titulo, endereco_resumido, bairro:bairros(nome))
      )
    `)
    .eq(`contrato.${colunaPessoa}`, pessoaId)
    .is('contrato.deleted_at', null)
    // Remove so a cancelada: o extrato e feito das parcelas pagas.
    .not('status_pagamento', 'in', STATUS_CANCELADA)
    .gte('mes_referencia', inicioAno)
    .lte('mes_referencia', fimAno)
    .order('mes_referencia', { ascending: true })

  const parcelas = ((parcelasRaw ?? []) as unknown as ParcelaRow[])

  // Para inquilino: só interessam as pagas no caixa (data_pagamento no ano)
  // Para proprietário: parcelas pagas (que geram repasse)
  const relevantes = parcelas.filter(p => p.status_pagamento === 'pago')

  // Totais
  const totalPago = relevantes.reduce((s, p) => s + (p.valor_pago ?? p.valor_total), 0)
  const totalJuros = relevantes.reduce((s, p) => s + (p.juros_multa ?? 0), 0)
  const totalDesconto = relevantes.reduce((s, p) => s + (p.desconto ?? 0), 0)
  const totalAluguel = relevantes.reduce((s, p) => s + p.valor_aluguel, 0)
  const totalSeguro = relevantes.reduce((s, p) => s + p.valor_seguro, 0)
  const totalComissao = relevantes.reduce((s, p) => s + p.valor_comissao, 0)
  const totalRepasse = relevantes.reduce((s, p) => s + p.valor_repasse_proprietario, 0)
  const totalRepassesPagos = relevantes
    .filter(p => p.status_repasse === 'pago')
    .reduce((s, p) => s + p.valor_repasse_proprietario, 0)

  // Distribuição por mês (pra resumo visual)
  const porMes: number[] = Array(12).fill(0)
  const porMesQtd: number[] = Array(12).fill(0)
  for (const p of relevantes) {
    const ref = parseInt(p.mes_referencia.slice(5, 7)) - 1
    if (ref >= 0 && ref < 12) {
      if (tipo === 'inquilino') porMes[ref] += (p.valor_pago ?? p.valor_total)
      else porMes[ref] += p.valor_repasse_proprietario
      porMesQtd[ref] += 1
    }
  }

  const naoPagas = parcelas.filter(p => p.status_pagamento !== 'pago')
  const enderecoPessoa = [
    pessoa?.endereco_logradouro && pessoa.endereco_numero
      ? `${pessoa.endereco_logradouro}, ${pessoa.endereco_numero}` : pessoa?.endereco_logradouro,
    pessoa?.endereco_bairro,
    pessoa?.endereco_cidade && pessoa?.endereco_estado
      ? `${pessoa.endereco_cidade}/${pessoa.endereco_estado}` : pessoa?.endereco_cidade,
  ].filter(Boolean).join(' - ')

  return (
    <div className="p-6 print:p-4">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <FileText size={20} className="text-violet-600" /> Relatórios anuais
        </h1>
        <FiltrosRelatorio pessoas={pessoas ?? []} tipo={tipo} pessoaId={pessoaId} ano={ano} />
      </div>

      {/* Cabeçalho do relatório (também aparece no print) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 print:shadow-none print:border-2 print:border-gray-900 print:rounded-none">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b-2 border-violet-600 mb-4">
          <div>
            <p className="text-[10px] tracking-widest font-bold text-violet-700 uppercase">{perfil?.nome ?? 'Imobiliária'}</p>
            <p className="text-[11px] text-gray-500">{perfil?.cpf} · {perfil?.telefone}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-widest font-bold text-violet-700 uppercase">
              {tipo === 'inquilino' ? 'Extrato de pagamentos' : 'Extrato de repasses'}
            </p>
            <p className="text-sm font-bold text-gray-900">{ano}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
              {tipo === 'inquilino' ? <User size={10} /> : <Building2 size={10} />}
              {tipo === 'inquilino' ? 'Inquilino' : 'Proprietário'}
            </p>
            <p className="font-bold text-gray-900">{pessoa?.nome}</p>
            <p className="text-xs text-gray-500">
              {pessoa?.cpf_cnpj} {pessoa?.telefone && `· ${pessoa.telefone}`}
            </p>
            {pessoa?.email && <p className="text-xs text-gray-500">{pessoa.email}</p>}
            {enderecoPessoa && <p className="text-xs text-gray-500">{enderecoPessoa}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Período</p>
            <p className="font-bold text-gray-900">01/01/{ano} a 31/12/{ano}</p>
            <p className="text-xs text-gray-500">{relevantes.length} pagamento{relevantes.length === 1 ? '' : 's'} confirmado{relevantes.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {/* Totalizadores grandes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {tipo === 'inquilino' ? (
            <>
              <Resumo label="Total pago" valor={totalPago} destaque />
              <Resumo label="Aluguel" valor={totalAluguel} />
              <Resumo label="Seguro" valor={totalSeguro} />
              <Resumo label="Juros / Multa" valor={totalJuros} />
            </>
          ) : (
            <>
              <Resumo label="Repasse total" valor={totalRepasse} destaque />
              <Resumo label="Repassado" valor={totalRepassesPagos} subtitulo="já foi pago" />
              <Resumo label="Pendente" valor={totalRepasse - totalRepassesPagos} subtitulo="falta repassar" />
              <Resumo label="Comissão (imob.)" valor={totalComissao} subtitulo="retido" />
            </>
          )}
        </div>
        {tipo === 'inquilino' && totalDesconto > 0 && (
          <p className="text-[11px] text-gray-400 text-right">
            Total de descontos: {formatarBRL(totalDesconto)}
          </p>
        )}
      </div>

      {/* Gráfico mensal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 print:shadow-none print:border print:border-gray-300 print:rounded-none">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Distribuição mensal</h2>
        <div className="grid grid-cols-12 gap-1 h-24 items-end">
          {porMes.map((v, i) => {
            const max = Math.max(...porMes, 1)
            const altura = (v / max) * 100
            return (
              <div key={i} className="flex flex-col items-center justify-end h-full" title={`${MESES[i]}: ${formatarBRL(v)}`}>
                <div
                  className={`w-full ${v > 0 ? 'bg-violet-500' : 'bg-gray-100'} rounded-t print:bg-gray-700`}
                  style={{ height: `${altura}%`, minHeight: v > 0 ? 4 : 1 }}
                />
                <span className="text-[10px] text-gray-400 mt-1">{MESES[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabela detalhada */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border print:border-gray-300 print:rounded-none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Pagamentos detalhados ({relevantes.length})</h2>
        </div>
        {relevantes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 px-4">
            Nenhum pagamento registrado nesse período pra esse {tipo === 'inquilino' ? 'inquilino' : 'proprietário'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs print:text-[10px]">
              <thead className="bg-gray-50 text-left font-semibold text-gray-500 print:bg-gray-200 print:text-black">
                <tr>
                  <th className="px-3 py-2">Mês ref.</th>
                  <th className="px-3 py-2">Pagamento</th>
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">Imóvel</th>
                  {tipo === 'inquilino' ? (
                    <>
                      <th className="px-3 py-2 text-right">Aluguel</th>
                      <th className="px-3 py-2 text-right">Seguro</th>
                      <th className="px-3 py-2 text-right">Juros</th>
                      <th className="px-3 py-2 text-right">Desconto</th>
                      <th className="px-3 py-2 text-right font-bold">Total pago</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right">Aluguel pago</th>
                      <th className="px-3 py-2 text-right">Comissão</th>
                      <th className="px-3 py-2 text-right font-bold">Repasse</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {relevantes.map(p => {
                  const c = unwrap(p.contrato) as { codigo: string; imovel: unknown } | null
                  const imo = unwrap(c?.imovel as { titulo: string; bairro: unknown } | null)
                  const bairro = unwrap(imo?.bairro as { nome: string } | null)
                  return (
                    <tr key={p.id} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-700">
                        {MESES[parseInt(p.mes_referencia.slice(5, 7)) - 1]}/{p.mes_referencia.slice(0, 4)}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{formatarData(p.data_pagamento)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{c?.codigo}</td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {imo?.titulo}
                        {bairro?.nome && <span className="text-gray-400"> · {bairro.nome}</span>}
                      </td>
                      {tipo === 'inquilino' ? (
                        <>
                          <td className="px-3 py-1.5 text-right">{formatarBRL(p.valor_aluguel)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-500">{p.valor_seguro > 0 ? formatarBRL(p.valor_seguro) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-red-600">{(p.juros_multa ?? 0) > 0 ? formatarBRL(p.juros_multa!) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-green-600">{(p.desconto ?? 0) > 0 ? `-${formatarBRL(p.desconto!)}` : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-900">{formatarBRL(p.valor_pago ?? p.valor_total)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-1.5 text-right">{formatarBRL(p.valor_pago ?? p.valor_total)}</td>
                          <td className="px-3 py-1.5 text-right text-violet-700">-{formatarBRL(p.valor_comissao)}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-green-700">{formatarBRL(p.valor_repasse_proprietario)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {p.status_repasse === 'pago'
                              ? <span className="inline-block text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Repassado</span>
                              : <span className="inline-block text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Pendente</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-bold print:bg-gray-100">
                <tr>
                  <td className="px-3 py-2 text-gray-700" colSpan={4}>TOTAIS</td>
                  {tipo === 'inquilino' ? (
                    <>
                      <td className="px-3 py-2 text-right">{formatarBRL(totalAluguel)}</td>
                      <td className="px-3 py-2 text-right">{formatarBRL(totalSeguro)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatarBRL(totalJuros)}</td>
                      <td className="px-3 py-2 text-right text-green-600">-{formatarBRL(totalDesconto)}</td>
                      <td className="px-3 py-2 text-right text-violet-700">{formatarBRL(totalPago)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right">{formatarBRL(totalPago)}</td>
                      <td className="px-3 py-2 text-right text-violet-700">-{formatarBRL(totalComissao)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatarBRL(totalRepasse)}</td>
                      <td className="px-3 py-2 text-center text-[10px] text-gray-500">
                        {formatarBRL(totalRepassesPagos)} pago
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pendentes (só inquilino e só impressa apenas se houver) */}
      {tipo === 'inquilino' && naoPagas.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-4 print:bg-white print:border-amber-400">
          <h2 className="text-sm font-bold text-amber-900 mb-2">Parcelas em aberto neste ano ({naoPagas.length})</h2>
          <ul className="text-xs space-y-1">
            {naoPagas.map(p => (
              <li key={p.id} className="flex items-center justify-between">
                <span className="text-amber-900">
                  {MESES[parseInt(p.mes_referencia.slice(5, 7)) - 1]}/{p.mes_referencia.slice(0, 4)} · venc. {formatarData(p.vencimento)}
                </span>
                <span className="font-semibold text-amber-900">{formatarBRL(p.valor_total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center mt-6 print:mt-4">
        Documento gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} ·
        Para validade fiscal, consulte os recibos individuais.
      </p>
    </div>
  )
}

function Resumo({ label, valor, subtitulo, destaque = false }: { label: string; valor: number; subtitulo?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${destaque ? 'bg-violet-50 print:bg-gray-100' : 'bg-gray-50 print:bg-white print:border print:border-gray-200'}`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`font-bold ${destaque ? 'text-lg text-violet-700' : 'text-base text-gray-900'}`}>{formatarBRL(valor)}</p>
      {subtitulo && <p className="text-[10px] text-gray-400">{subtitulo}</p>}
    </div>
  )
}
