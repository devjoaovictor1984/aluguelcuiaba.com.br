'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2, XCircle, Clock, MinusCircle, Loader2, Play, Copy, Check,
  ChevronDown, AlertCircle,
} from 'lucide-react'
import { maskCep, maskCpfCnpj, maskMoney, maskTelefone, parseMoney } from '@/lib/formatters'
import type { PassoDiagnostico, ResultadoDiagnostico } from '@/lib/seguros/incendio/diagnostico'
import { rodarDiagnosticoIncendio } from '../actions'

/**
 * Duas colunas: à esquerda o que se manda, à direita o que volta.
 *
 * O formulário nasce preenchido de propósito. Quem abre este link está
 * fazendo um favor para nós — pedir que digite dezoito campos antes de ver
 * qualquer coisa é a melhor forma de não receber retorno nenhum. Vem
 * pronto, roda em um clique, e quem quiser mexe.
 */

const input =
  'w-full rounded-xl border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ' +
  'ring-1 ring-gray-200 focus:ring-2 focus:ring-orange-500 outline-none'
const label = 'block text-[11px] font-semibold text-gray-500 mb-1'

const ICONE: Record<PassoDiagnostico['estado'], typeof CheckCircle2> = {
  ok: CheckCircle2,
  lento: Clock,
  falhou: XCircle,
  pulado: MinusCircle,
}

const COR: Record<PassoDiagnostico['estado'], string> = {
  ok: 'text-emerald-600',
  lento: 'text-amber-600',
  falhou: 'text-red-600',
  pulado: 'text-gray-300',
}

const FUNDO: Record<PassoDiagnostico['estado'], string> = {
  ok: 'bg-emerald-50 ring-emerald-200',
  lento: 'bg-amber-50 ring-amber-200',
  falhou: 'bg-red-50 ring-red-200',
  pulado: 'bg-gray-50 ring-gray-200',
}

const RESUMO: Record<PassoDiagnostico['estado'], string> = {
  ok: 'OK',
  lento: 'OK, mas lento',
  falhou: 'FALHOU',
  pulado: 'não rodou',
}

function segundos(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

export function PainelDiagnostico({
  sessao,
}: {
  sessao: { nome: string; organizacao?: string | null }
}) {
  const [pendente, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<ResultadoDiagnostico | null>(null)
  const [copiado, setCopiado] = useState(false)

  const [seguradora, setSeguradora] = useState('Alfa')
  const [tipoSeguro, setTipoSeguro] = useState<'R' | 'C'>('R')
  const [tipoVigencia, setTipoVigencia] = useState<0 | 1>(0)
  const [aluguel, setAluguel] = useState('1.800,00')

  const [inqNome, setInqNome] = useState('ANDRESSA SIMAO DA SILVA')
  const [inqDoc, setInqDoc] = useState('138.707.247-14')
  const [inqNasc, setInqNasc] = useState('1993-05-25')
  const [inqEmail, setInqEmail] = useState('andressassimao@hotmail.com')
  const [inqFone, setInqFone] = useState('(21) 97993-1028')

  const [propNome, setPropNome] = useState('RIVÂNIA SILVA PASSOS COUTINHO')
  const [propDoc, setPropDoc] = useState('361.799.901-82')

  const [cep, setCep] = useState('78048-258')
  const [endereco, setEndereco] = useState('R. A, 11 - Res. Paiaguás')
  const [numero, setNumero] = useState('103')
  const [bairro, setBairro] = useState('Paiaguás')
  const [cidade, setCidade] = useState('Cuiabá')
  const [uf, setUf] = useState('MT')

  const rodar = () => {
    setErro('')
    setResultado(null)
    setCopiado(false)
    startTransition(async () => {
      const r = await rodarDiagnosticoIncendio({
        seguradora,
        tipoSeguro,
        tipoVigencia,
        tipoCobertura: 2,
        aluguel: parseMoney(aluguel),
        inquilino: {
          tipo: inqDoc.replace(/\D/g, '').length > 11 ? 'J' : 'F',
          nome: inqNome,
          cpfCnpj: inqDoc.replace(/\D/g, ''),
          email: inqEmail,
          dataNascimento: inqNasc,
          telefone: inqFone.replace(/\D/g, ''),
        },
        proprietario: {
          tipo: propDoc.replace(/\D/g, '').length > 11 ? 'J' : 'F',
          nome: propNome,
          cpfCnpj: propDoc.replace(/\D/g, ''),
        },
        endereco: {
          cep: cep.replace(/\D/g, ''),
          endereco, numero, bairro, cidade, uf,
        },
      })
      if (r.error) { setErro(r.error); return }
      setResultado(r.resultado ?? null)
    })
  }

  /** O relatório em texto, pronto pra colar no WhatsApp ou no e-mail. */
  const relatorio = (): string => {
    if (!resultado) return ''
    const linhas = [
      'DIAGNÓSTICO DA COTAÇÃO DE INCÊNDIO — AluguelCuiabá × Maximiza',
      `Quando: ${new Date().toLocaleString('pt-BR')}`,
      `Ambiente: ${resultado.ambiente === 1 ? 'PRODUÇÃO' : 'homologação'}`,
      `CNPJ da imobiliária: ${resultado.cnpjImobiliaria}`,
      `Seguradora pedida: ${seguradora} · ${tipoSeguro === 'R' ? 'residencial' : 'comercial'}` +
        ` · ${tipoVigencia === 0 ? 'anual' : 'mensalizado'}`,
      `Sessão: ${sessao.nome}${sessao.organizacao ? ` (${sessao.organizacao})` : ''}`,
      '',
    ]
    for (const p of resultado.passos) {
      linhas.push(`[${RESUMO[p.estado]}] ${p.titulo} — ${segundos(p.duracaoMs)}${
        p.httpStatus ? ` · HTTP ${p.httpStatus}` : ''
      }`)
      linhas.push(`    ${p.endpoint}`)
      linhas.push(`    ${p.mensagem}`)
    }
    return linhas.join('\n')
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorio())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não consegui copiar. Selecione o texto e copie à mão.')
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      {/* ── Esquerda: o que vai ── */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Dados da cotação</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Já vem preenchido com um caso real. Mude o que quiser, ou só aperte o botão.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Seguradora</label>
            <select value={seguradora} onChange={e => setSeguradora(e.target.value)} className={input}>
              <option>Alfa</option>
              <option>Porto</option>
            </select>
          </div>
          <div>
            <label className={label}>Tipo</label>
            <select
              value={tipoSeguro}
              onChange={e => setTipoSeguro(e.target.value as 'R' | 'C')}
              className={input}
            >
              <option value="R">Residencial</option>
              <option value="C">Comercial</option>
            </select>
          </div>
          <div>
            <label className={label}>Vigência</label>
            <select
              value={tipoVigencia}
              onChange={e => setTipoVigencia(Number(e.target.value) as 0 | 1)}
              className={input}
            >
              <option value={0}>Anual</option>
              <option value={1}>Mensalizado</option>
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Aluguel</label>
          <input
            value={aluguel}
            onChange={e => setAluguel(maskMoney(e.target.value))}
            className={input}
            inputMode="numeric"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Os limites de cada cobertura são calculados a partir dele.
          </p>
        </div>

        <div className="pt-1 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-700 mb-2 mt-3">Inquilino</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={label}>Nome</label>
              <input value={inqNome} onChange={e => setInqNome(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>CPF / CNPJ</label>
              <input
                value={inqDoc}
                onChange={e => setInqDoc(maskCpfCnpj(e.target.value))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Nascimento</label>
              <input
                type="date"
                value={inqNasc}
                onChange={e => setInqNasc(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>E-mail</label>
              <input value={inqEmail} onChange={e => setInqEmail(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Celular</label>
              <input
                value={inqFone}
                onChange={e => setInqFone(maskTelefone(e.target.value))}
                className={input}
              />
            </div>
          </div>
        </div>

        <div className="pt-1 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-700 mb-2 mt-3">Proprietário</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Nome</label>
              <input value={propNome} onChange={e => setPropNome(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>CPF / CNPJ</label>
              <input
                value={propDoc}
                onChange={e => setPropDoc(maskCpfCnpj(e.target.value))}
                className={input}
              />
            </div>
          </div>
        </div>

        <div className="pt-1 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-700 mb-2 mt-3">Imóvel</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>CEP</label>
              <input
                value={cep}
                onChange={e => setCep(maskCep(e.target.value))}
                className={input}
                inputMode="numeric"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Endereço</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Número</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Bairro</label>
              <input value={bairro} onChange={e => setBairro(e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Cidade</label>
                <input value={cidade} onChange={e => setCidade(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>UF</label>
                <input
                  value={uf}
                  onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))}
                  className={input}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={rodar}
          disabled={pendente}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3
                     text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pendente
            ? <><Loader2 size={15} className="animate-spin" /> Rodando… pode levar até 1 minuto</>
            : <><Play size={15} /> Rodar diagnóstico</>}
        </button>

        <p className="text-[11px] text-gray-400 leading-snug">
          O diagnóstico consulta o cadastro, busca os catálogos e calcula o prêmio.
          Não contrata, não emite apólice e não gera cobrança — pode rodar quantas
          vezes quiser.
        </p>
      </section>

      {/* ── Direita: o que voltou ── */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3 lg:sticky lg:top-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">O que aconteceu</h2>
          {resultado && (
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5
                         text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
            >
              {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar relatório</>}
            </button>
          )}
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 ring-1 ring-red-200 px-3 py-2.5">
            <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-900">{erro}</p>
          </div>
        )}

        {!resultado && !pendente && !erro && (
          <p className="py-10 text-center text-xs text-gray-400">
            Aperte &ldquo;Rodar diagnóstico&rdquo; e os passos aparecem aqui.
          </p>
        )}

        {pendente && (
          <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-xs">Falando com a corretora…</p>
          </div>
        )}

        {resultado && (
          <>
            <div className="space-y-2">
              {resultado.passos.map(p => <Passo key={p.chave} passo={p} />)}
            </div>

            {resultado.calculo && (
              <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3.5 py-3">
                <p className="text-[11px] font-bold text-emerald-900">Cotação fechada</p>
                <p className="mt-1 text-sm font-bold text-emerald-900">
                  Prêmio R$ {resultado.calculo.premio.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[11px] text-emerald-800">
                  Líquido R$ {resultado.calculo.premioLiquido.toFixed(2).replace('.', ',')} ·
                  IOF R$ {resultado.calculo.iof.toFixed(2).replace('.', ',')} ·
                  {' '}{resultado.calculo.coberturas.length} coberturas
                </p>
              </div>
            )}

            {resultado.escolhas?.ocupacao && (
              <p className="text-[11px] text-gray-400 leading-snug">
                O diagnóstico usou a primeira ocupação do catálogo
                (&ldquo;{resultado.escolhas.ocupacao.nome}&rdquo;, rubrica{' '}
                {resultado.escolhas.ocupacao.rubrica}/{resultado.escolhas.ocupacao.cdresp2})
                {resultado.escolhas.assistencia &&
                  <> e o pacote de assistência {resultado.escolhas.assistencia.codigo}</>}.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Passo({ passo }: { passo: PassoDiagnostico }) {
  const [aberto, setAberto] = useState(false)
  const Icone = ICONE[passo.estado]

  return (
    <div className={`rounded-xl ring-1 px-3.5 py-3 ${FUNDO[passo.estado]}`}>
      <div className="flex items-start gap-2.5">
        <Icone size={15} className={`${COR[passo.estado]} shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-gray-900">{passo.titulo}</p>
            <p className="text-[11px] font-semibold text-gray-500 shrink-0">
              {passo.estado === 'pulado' ? '—' : segundos(passo.duracaoMs)}
              {passo.httpStatus ? ` · ${passo.httpStatus}` : ''}
            </p>
          </div>

          <p className="mt-0.5 text-[11px] text-gray-700 leading-snug">{passo.mensagem}</p>

          <button
            type="button"
            onClick={() => setAberto(a => !a)}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold
                       text-gray-400 hover:text-gray-700"
          >
            <ChevronDown size={11} className={aberto ? 'rotate-180 transition-transform' : 'transition-transform'} />
            detalhes técnicos
          </button>

          {aberto && (
            <div className="mt-1.5 space-y-1 border-t border-black/5 pt-1.5">
              <p className="text-[10px] text-gray-500 leading-snug">{passo.explicacao}</p>
              <p className="font-mono text-[10px] text-gray-600 break-all">{passo.endpoint}</p>
              {passo.detalheTecnico && (
                <p className="font-mono text-[10px] text-gray-500 break-all">{passo.detalheTecnico}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
