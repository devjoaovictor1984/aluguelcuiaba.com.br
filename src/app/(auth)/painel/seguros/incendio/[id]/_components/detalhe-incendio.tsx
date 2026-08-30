'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertTriangle, FileText, Trash2, ShieldCheck, CheckCircle2,
  Download, Ban, Wallet, CreditCard, Info, Receipt,
} from 'lucide-react'
import { formatarBRL } from '@/lib/formatters'
import {
  COBERTURA_LABEL, VIGENCIA_LABEL,
  type ResultadoCalculo, type TipoCobertura, type TipoVigencia,
} from '@/lib/seguros/incendio/tipos'
import {
  estimarProLabore, opcoesParcelamento, PARCELA_MINIMA, PRO_LABORE_PADRAO,
} from '@/lib/seguros/incendio/sugestoes'
import {
  baixarDocumentosIncendio, cancelarApoliceIncendio,
  contratarApoliceIncendio, excluirApoliceIncendio,
} from '../../../actions-incendio'

interface ApoliceView {
  id: string
  seguradora: string
  status: string
  tipoSeguro: string
  tipoVigencia: number
  tipoCobertura: number | null
  valorAluguel: number | null
  premioTotal: number | null
  valorIof: number | null
  valorAssistencia: number | null
  valorParcela: number | null
  qtdParcelas: number | null
  formaPagtoDescricao: string | null
  inicioVigencia: string | null
  fimVigencia: string | null
  codigoSeguro: string | null
  numeroProposta: string | null
  calculo: ResultadoCalculo | null
  erro: string | null
  cancelamentoMsg: string | null
  contratadaEm: string | null
}

interface DocumentoView {
  id: string
  tipo: 'certificado' | 'proposta' | 'boleto'
  numParcela: number | null
  dataVencimento: string | null
  dataPagamento: string | null
  url: string | null
}

interface Props {
  apolice: ApoliceView
  documentos: DocumentoView[]
  /** 1 = produção (emite de verdade) · 2 = homologação · null = env ausente. */
  ambiente: 1 | 2 | null
}

const dataBr = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

/** Taxa de cobertura: prêmio sobre o limite. Fração pequena, precisa de casas. */
const fmtTaxa = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`

const fmtPercent = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export function DetalheIncendio({ apolice: a, documentos, ambiente }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  // Separado do erro de propósito: "o boleto ainda não saiu" é o curso
  // normal das coisas, e pintar isso de vermelho faz o corretor achar que
  // a operação falhou quando ela deu certo pela metade combinada.
  const [aviso, setAviso] = useState('')

  /** Toda ação começa limpando o que sobrou da anterior. */
  const limpar = () => { setErro(''); setMsg(''); setAviso('') }
  const [escolha, setEscolha] = useState<{ codigo: string; descricao: string; qtd: number; valor: number } | null>(null)

  /**
   * Em produção o botão de contratar emite apólice real, com cobrança ao
   * cliente. A tela é a mesma da homologação — só o ambiente muda —, então
   * a única coisa que separa um teste de uma emissão é a atenção de quem
   * clica. Este passo existe pra isso não ser verdade.
   */
  const emProducao = ambiente === 1
  const [cienteProducao, setCienteProducao] = useState(false)

  const contratada = a.status === 'contratada'
  const cancelada = a.status === 'cancelada'
  const podeContratar = a.status === 'calculada'

  const proLabore = estimarProLabore(a.premioTotal ?? 0)

  /**
   * As opções de pagamento: as da corretora quando ela manda, as nossas
   * quando não manda. A Alfa devolve `listaFormasPagto` vazia, e sem esta
   * queda a cotação calculava sem ter como ser contratada.
   */
  const formasApi = a.calculo?.formasPagamento ?? []
  const derivado = formasApi.length === 0
  const opcoes = derivado
    ? opcoesParcelamento(a.calculo?.premio ?? a.premioTotal ?? 0)
        .map(p => ({ codigo: '', ...p }))
    : formasApi.flatMap(f => f.parcelas.map(p => ({ codigo: f.codigo, ...p })))

  const contratar = () => {
    limpar()
    if (!escolha) { setErro('Escolha a forma de pagamento.'); return }
    startTransition(async () => {
      const r = await contratarApoliceIncendio(a.id, {
        formaPagtoCodigo: escolha.codigo,
        formaPagtoDescricao: escolha.descricao,
        qtdParcelas: escolha.qtd,
        valorParcela: escolha.valor,
        confirmaEmissaoReal: cienteProducao,
      })
      if ('error' in r && r.error) { setErro(r.error); return }
      setMsg('ok' in r ? `Contratado. Apólice ${r.codigoSeguro}.` : 'Contratado.')
      router.refresh()
    })
  }

  const baixar = () => {
    limpar()
    startTransition(async () => {
      const r = await baixarDocumentosIncendio(a.id)
      if (r.error) { setErro(r.error); return }
      setMsg(`${r.baixados} documento(s) baixado(s).`)
      // Baixa parcial é o caso normal logo após contratar: o certificado
      // sai na hora, o boleto depende do lote da seguradora.
      if (r.aviso) setAviso(r.aviso)
      router.refresh()
    })
  }

  const cancelar = () => {
    if (!confirm('Cancelar esta apólice na seguradora? A operação é registrada lá.')) return
    limpar()
    startTransition(async () => {
      const r = await cancelarApoliceIncendio(a.id)
      if (r.error) { setErro(r.error); return }
      setMsg(r.mensagem ?? 'Apólice cancelada.')
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm('Excluir esta cotação? Não dá pra desfazer.')) return
    limpar()
    startTransition(async () => {
      const r = await excluirApoliceIncendio(a.id)
      if (r.error) { setErro(r.error); return }
      router.push('/painel/seguros/incendio')
    })
  }

  return (
    <div className="space-y-4">
      {a.erro && (
        <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Falha na operação</p>
            <p className="text-xs mt-0.5">{a.erro}</p>
          </div>
        </div>
      )}

      {/* Cartão principal — prêmio, pró-labore e identificadores */}
      {a.premioTotal != null && (
        <section className={`rounded-2xl px-4 py-4 text-white ${
          cancelada ? 'bg-gray-500' : contratada ? 'bg-emerald-600' : 'bg-orange-600'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                {cancelada ? 'Apólice cancelada' : contratada ? 'Seguro contratado' : 'Prêmio calculado'}
              </p>
              <p className="text-lg font-black leading-tight">{a.seguradora}</p>
            </div>
            <ShieldCheck size={22} className="opacity-90 shrink-0" />
          </div>

          <p className="text-3xl font-black tabular-nums mt-2">{formatarBRL(a.premioTotal)}</p>
          {a.qtdParcelas && a.valorParcela != null && (
            <p className="text-sm opacity-90">
              {a.formaPagtoDescricao} · {a.qtdParcelas}× {formatarBRL(a.valorParcela)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/20 text-[11px]">
            <div>
              <p className="opacity-70">Vigência</p>
              <p className="font-semibold tabular-nums">
                {dataBr(a.inicioVigencia)} → {dataBr(a.fimVigencia)}
              </p>
            </div>
            <div>
              <p className="opacity-70">Modalidade</p>
              <p className="font-semibold">
                {VIGENCIA_LABEL[a.tipoVigencia as TipoVigencia] ?? '—'}
                {a.tipoSeguro === 'C' ? ' · Comercial' : ' · Residencial'}
              </p>
            </div>
            {a.numeroProposta && (
              <div>
                <p className="opacity-70">Proposta</p>
                <p className="font-semibold tabular-nums">{a.numeroProposta}</p>
              </div>
            )}
            {a.codigoSeguro && (
              <div>
                <p className="opacity-70">Apólice</p>
                <p className="font-semibold tabular-nums">{a.codigoSeguro}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Pró-labore — o que interessa ao corretor */}
      {a.premioTotal != null && !cancelada && (
        <section className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
            <Wallet size={11} /> Seu pró-labore
          </p>
          <p className="text-2xl font-black text-emerald-900 tabular-nums">
            {formatarBRL(proLabore)}
          </p>
          <p className="text-[11px] text-emerald-800 leading-snug">
            Estimativa a {Math.round(PRO_LABORE_PADRAO * 100)}% do prêmio, como
            aparece no painel da corretora. Confirme a tabela vigente.
          </p>
        </section>
      )}

      {/* Composição do prêmio */}
      {a.calculo && (
        <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Coberturas contratadas</h2>
          <div className="space-y-1.5">
            {a.calculo.coberturas.map(c => (
              <div key={c.codigo} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 leading-tight">{c.nome}</p>
                  {c.franquia && (
                    <p className="text-[11px] text-gray-400 leading-tight">{c.franquia}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 tabular-nums">{formatarBRL(c.limite)}</p>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    prêmio {formatarBRL(c.premio)}
                    {c.limite > 0 && <> · taxa {fmtTaxa(c.premio / c.limite)}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-50 space-y-1 text-xs">
            <Linha rotulo="Prêmio líquido" valor={a.calculo.premioLiquido} />
            {a.calculo.valorAssistencia > 0 && (
              <Linha rotulo="Assistência 24h" valor={a.calculo.valorAssistencia} />
            )}
            <Linha rotulo="IOF" valor={a.calculo.iof} />
            <div className="flex justify-between pt-1 border-t border-gray-50">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-black text-gray-900 tabular-nums">
                {formatarBRL(a.calculo.premio)}
              </span>
            </div>
            {/* O peso do seguro sobre o aluguel — é o número que convence o
                proprietário, e o painel da corretora mostra ao lado do total. */}
            {(a.valorAluguel ?? 0) > 0 && a.calculo.premio > 0 && (
              <p className="text-[11px] text-gray-500 pt-0.5">
                {fmtPercent(a.calculo.premio / (a.valorAluguel as number))} do valor
                do aluguel {a.tipoVigencia === 0 ? 'no ano' : 'no mês'}
              </p>
            )}
          </div>

          {a.tipoCobertura && (
            <p className="text-[11px] text-gray-400">
              {COBERTURA_LABEL[a.tipoCobertura as TipoCobertura]}
            </p>
          )}
        </section>
      )}

      {/* Escolha do pagamento */}
      {podeContratar && opcoes.length ? (
        <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Forma de pagamento</h2>

          {opcoes.map((p, i) => {
            const ativo = escolha?.codigo === p.codigo && escolha.qtd === p.qtdParcelas
            // A seguradora recusa parcela abaixo do mínimo — melhor
            // desabilitar do que deixar o corretor levar erro depois.
            const abaixoMinimo = p.qtdParcelas > 1 && p.valorParcela < PARCELA_MINIMA
            const cartao = /cart[aã]o/i.test(p.descricao)

            return (
              <button
                key={`${p.codigo}-${i}`}
                type="button"
                disabled={abaixoMinimo || cartao}
                onClick={() => setEscolha({
                  codigo: p.codigo, descricao: p.descricao,
                  qtd: p.qtdParcelas, valor: p.valorParcela,
                })}
                className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                  abaixoMinimo || cartao
                    ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    : ativo
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-100 hover:border-orange-300'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {cartao && <CreditCard size={12} className="text-gray-400" />}
                    {p.descricao}
                  </span>
                  <span className="text-sm font-bold text-orange-700 tabular-nums shrink-0">
                    {p.qtdParcelas}× {formatarBRL(p.valorParcela)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  total {formatarBRL(p.qtdParcelas * p.valorParcela)}
                  {abaixoMinimo && <> · abaixo da parcela mínima de {formatarBRL(PARCELA_MINIMA)}</>}
                  {cartao && <> · cartão não é feito pela plataforma</>}
                </p>
              </button>
            )
          })}

          {derivado && (
            <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
              A seguradora não devolveu as formas de pagamento nesta cotação.
              O parcelamento acima é calculado sobre o prêmio, respeitando a
              parcela mínima de {formatarBRL(PARCELA_MINIMA)} — a mesma conta
              que o painel da corretora faz.
            </p>
          )}

          <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
            Pagamento por cartão fica com a corretora — não trafegamos dados de
            cartão pela plataforma.
          </p>

          {emProducao && (
            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl bg-red-50 ring-1 ring-red-300 px-3.5 py-3">
              <input
                type="checkbox"
                checked={cienteProducao}
                onChange={e => setCienteProducao(e.target.checked)}
                className="w-4 h-4 mt-0.5 shrink-0 accent-red-600"
              />
              <span className="text-[11px] text-red-900 leading-snug">
                <strong>Isto emite uma apólice de verdade.</strong> O cliente
                {escolha && <> vai ser cobrado em {escolha.qtd}× {formatarBRL(escolha.valor)}</>}
                {' '}e o cancelamento passa a ter prazo e regra de estorno.
                Não é teste.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={contratar}
            disabled={isPending || !escolha || (emProducao && !cienteProducao)}
            className={`w-full flex items-center justify-center gap-2 rounded-xl disabled:opacity-50 py-3.5 font-semibold text-white ${
              emProducao ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isPending
              ? 'Contratando…'
              : emProducao ? 'Emitir apólice real' : 'Contratar seguro'}
          </button>
        </section>
      ) : null}

      {msg && <p className="text-xs text-emerald-800 bg-emerald-50 ring-1 ring-emerald-100 rounded-xl px-3 py-2.5">{msg}</p>}
      {aviso && <p className="text-xs text-amber-900 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2.5">{aviso}</p>}
      {erro && <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-100 rounded-xl px-3 py-2.5">{erro}</p>}

      {a.cancelamentoMsg && (
        <p className="text-xs text-gray-600 bg-gray-50 ring-1 ring-gray-100 rounded-xl px-3 py-2.5">
          {a.cancelamentoMsg}
        </p>
      )}

      {/* Documentos */}
      {contratada && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Documentos
            </h2>
            <button
              type="button"
              onClick={baixar}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {documentos.length ? 'Atualizar' : 'Baixar da seguradora'}
            </button>
          </div>

          {documentos.length === 0 ? (
            <p className="text-xs text-gray-500 bg-white ring-1 ring-gray-100 rounded-2xl p-6 text-center">
              Certificado, proposta e boletos ficam disponíveis na seguradora.
              Toque em baixar.
            </p>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-gray-100 divide-y divide-gray-50 overflow-hidden">
              {documentos.map(d => (
                <a
                  key={d.id}
                  href={d.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 px-4 py-3.5 active:bg-gray-50 ${!d.url ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg grid place-items-center bg-orange-50">
                    {d.tipo === 'boleto'
                      ? <Receipt size={14} className="text-orange-600" />
                      : <FileText size={14} className="text-orange-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 capitalize">
                      {d.tipo}
                      {d.tipo === 'boleto' && d.numParcela ? ` — parcela ${d.numParcela}` : ''}
                    </p>
                    {d.dataVencimento && (
                      <p className="text-[11px] text-gray-400">
                        vence {d.dataVencimento}
                        {d.dataPagamento && <> · pago {d.dataPagamento}</>}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex justify-between pt-1">
        {contratada ? (
          <button
            type="button"
            onClick={cancelar}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-rose-600 active:text-rose-700 px-3 py-2 rounded-lg"
          >
            <Ban size={14} /> Cancelar apólice
          </button>
        ) : <span />}

        {!contratada && (
          <button
            type="button"
            onClick={excluir}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-rose-600 active:text-rose-700 px-3 py-2 rounded-lg ml-auto"
          >
            <Trash2 size={14} /> Excluir cotação
          </button>
        )}
      </div>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{rotulo}</span>
      <span className="tabular-nums">{formatarBRL(valor)}</span>
    </div>
  )
}
