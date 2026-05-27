'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, User, Shield, DollarSign, Check, ArrowRight, ArrowLeft,
  AlertCircle, Loader2, FileSignature, Sofa,
} from 'lucide-react'
import { criarContrato, type ContratoInput } from '../../actions'
import { gerarParcelas, resumirParcelas } from '@/lib/crm/calculos'
import { InputMoeda, InputPercentual } from '@/components/inputs/input-mascarado'
import { parseMoney, parsePercentual } from '@/lib/formatters'
import type { ImovelLite, PessoaLite, WizardState } from './wizard-types'
import { ESTADO_INICIAL } from './wizard-types'

interface Props {
  imoveis: ImovelLite[]
  pessoas: PessoaLite[]
}

const ETAPAS = [
  { id: 1, label: 'Imóvel',     icon: Home },
  { id: 2, label: 'Pessoas',    icon: User },
  { id: 3, label: 'Perfil',     icon: Sofa },
  { id: 4, label: 'Garantia',   icon: Shield },
  { id: 5, label: 'Valores',    icon: DollarSign },
  { id: 6, label: 'Revisão',    icon: Check },
]

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function parseNumero(s: string): number {
  return parseMoney(s)
}

function formatarValorInicial(n: number | null | undefined): string {
  if (!n) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WizardContrato({ imoveis, pessoas }: Props) {
  const router = useRouter()
  const [etapa, setEtapa] = useState(1)
  const [s, set] = useState<WizardState>(ESTADO_INICIAL)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const setField = <K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    set(prev => ({ ...prev, [k]: v }))
  }

  const inquilinos    = useMemo(() => pessoas.filter(p => p.tipo === 'inquilino'),    [pessoas])
  const proprietarios = useMemo(() => pessoas.filter(p => p.tipo === 'proprietario'), [pessoas])
  const fiadores      = useMemo(() => pessoas.filter(p => p.tipo === 'fiador'),       [pessoas])

  const imovelSel = imoveis.find(i => i.id === s.imovel_id)

  // Pré-preenche proprietário e valor sugerido quando escolhe o imóvel
  const onEscolherImovel = (id: string) => {
    setField('imovel_id', id)
    const im = imoveis.find(x => x.id === id)
    if (im) {
      if (!s.valor_aluguel) setField('valor_aluguel', formatarValorInicial(im.preco))
      if (!s.proprietario_id && im.proprietario_id) setField('proprietario_id', im.proprietario_id)
    }
  }

  // Cálculo das parcelas em tempo real (preview na revisão)
  const previewParcelas = useMemo(() => {
    const valor = parseNumero(s.valor_aluguel)
    const duracao = parseInt(s.duracao_meses) || 0
    if (!valor || !duracao || !s.data_primeiro_aluguel) return []
    return gerarParcelas({
      duracao_meses: duracao,
      data_primeiro_aluguel: s.data_primeiro_aluguel,
      dia_vencimento: parseInt(s.dia_vencimento) || 1,
      valor_aluguel: valor,
      valor_seguro_fianca_mensal: parseNumero(s.valor_seguro_fianca_mensal),
      iptu_mensal: parseNumero(s.iptu_mensal),
      condominio_mensal: parseNumero(s.condominio_mensal),
      taxa_admin_tipo: s.taxa_admin_tipo,
      taxa_admin_valor: s.taxa_admin_tipo === 'percentual'
        ? parsePercentual(s.taxa_admin_valor)
        : parseMoney(s.taxa_admin_valor),
      primeira_parcela_cheia: s.primeira_parcela_cheia,
    })
  }, [s])

  const resumo = useMemo(() => resumirParcelas(previewParcelas), [previewParcelas])

  // Validação por etapa
  const podeAvancar = (): string | null => {
    if (etapa === 1) {
      if (!s.imovel_id) return 'Escolha um imóvel.'
    }
    if (etapa === 2) {
      if (!s.inquilino_id) return 'Escolha o inquilino.'
      if (!s.proprietario_id) return 'Escolha o proprietário.'
    }
    if (etapa === 3) {
      // Perfil: validação leve — só checa que o pet não está com texto solto sem permitir
      if ((s.aceita_pet === 'nao') && s.pet_observacao.trim()) {
        // permitido — só observação informativa
      }
      // Mobília mobiliada sem inventário: aceita, mas o checklist do PDF avisará
    }
    if (etapa === 4) {
      if (s.garantia_tipo === 'fiador' && !s.fiador_id) return 'Escolha o fiador.'
      if (s.garantia_tipo === 'caucao' && !parseNumero(s.caucao_valor)) return 'Informe o valor da caução.'
      if (s.garantia_tipo === 'seguro_fianca') {
        if (!s.seguro_fianca_seguradora.trim()) return 'Informe a seguradora.'
        if (!s.seguro_fianca_apolice.trim()) return 'Informe o número da apólice.'
      }
    }
    if (etapa === 5) {
      if (!parseNumero(s.valor_aluguel)) return 'Informe o valor do aluguel.'
      if (!s.data_inicio) return 'Informe a data de início.'
      if (!s.data_primeiro_aluguel) return 'Informe a data do 1º aluguel.'
      if (!parseInt(s.duracao_meses)) return 'Informe a duração em meses.'
      if (!parseInt(s.dia_vencimento)) return 'Informe o dia de vencimento.'
    }
    return null
  }

  const avancar = () => {
    const e = podeAvancar()
    if (e) { setErro(e); return }
    setErro('')
    setEtapa(et => Math.min(et + 1, ETAPAS.length))
  }
  const voltar = () => { setErro(''); setEtapa(et => Math.max(et - 1, 1)) }

  const salvar = () => {
    setErro('')
    const payload: ContratoInput = {
      imovel_id: s.imovel_id,
      inquilino_id: s.inquilino_id,
      proprietario_id: s.proprietario_id,
      valor_aluguel: parseNumero(s.valor_aluguel),
      valor_seguro_fianca_mensal: parseNumero(s.valor_seguro_fianca_mensal),
      valor_seguro_incendio_anual: parseNumero(s.valor_seguro_incendio_anual) || null,
      seguro_incendio_data: s.seguro_incendio_data || null,
      iptu_mensal: parseNumero(s.iptu_mensal),
      condominio_mensal: parseNumero(s.condominio_mensal),
      taxa_admin_tipo: s.taxa_admin_tipo,
      taxa_admin_valor: s.taxa_admin_tipo === 'percentual'
        ? parsePercentual(s.taxa_admin_valor)
        : parseMoney(s.taxa_admin_valor),
      primeira_parcela_cheia: s.primeira_parcela_cheia,
      garantia_tipo: s.garantia_tipo,
      fiador_id: s.garantia_tipo === 'fiador' ? s.fiador_id : null,
      caucao_valor: s.garantia_tipo === 'caucao' ? parseNumero(s.caucao_valor) : null,
      seguro_fianca_seguradora: s.garantia_tipo === 'seguro_fianca' ? s.seguro_fianca_seguradora : null,
      seguro_fianca_apolice: s.garantia_tipo === 'seguro_fianca' ? s.seguro_fianca_apolice : null,
      data_inicio: s.data_inicio,
      data_primeiro_aluguel: s.data_primeiro_aluguel,
      data_termino: s.data_termino || null,
      duracao_meses: parseInt(s.duracao_meses),
      dia_vencimento: parseInt(s.dia_vencimento),
      forma_pagamento: s.forma_pagamento,
      observacoes: s.observacoes || null,
      clausulas_extras: s.clausulas_extras || null,
      indice_reajuste: s.indice_reajuste || null,
      data_proximo_reajuste: s.data_proximo_reajuste || null,
      tipo_atuacao: s.tipo_atuacao,
      intermediador_assina: s.intermediador_assina,
      tipo_mobilia: s.tipo_mobilia,
      tem_inventario_bens: s.tem_inventario_bens,
      aceita_pet: s.aceita_pet,
      pet_observacao: s.pet_observacao || null,
    }

    startTransition(async () => {
      const r = await criarContrato(payload)
      if (r.error) { setErro(r.error); return }
      router.push(`/painel/contratos/${r.id}`)
      router.refresh()
    })
  }

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      {/* Stepper */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        {ETAPAS.map((et, i) => {
          const ativo = et.id === etapa
          const passado = et.id < etapa
          return (
            <div key={et.id} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  ativo ? 'bg-violet-700 text-white' :
                  passado ? 'bg-green-500 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {passado ? <Check size={14} /> : <et.icon size={13} />}
                </div>
                <span className={`text-xs font-medium ${ativo ? 'text-violet-700' : passado ? 'text-green-600' : 'text-gray-400'}`}>
                  {et.label}
                </span>
              </div>
              {i < ETAPAS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${passado ? 'bg-green-300' : 'bg-gray-100'}`} />}
            </div>
          )
        })}
      </div>

      {/* Etapa 1 — Imóvel */}
      {etapa === 1 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Qual imóvel será locado?</h2>
          {imoveis.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              Você ainda não tem imóveis cadastrados.
              <br />
              <Link href="/painel/anuncios/novo" className="text-violet-600 hover:underline">Cadastrar um imóvel →</Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(() => {
                const livres = imoveis.filter(im => !im.ocupado)
                const ocupados = imoveis.filter(im => im.ocupado)
                return (
                  <>
                    {livres.map(im => {
                      const sel = s.imovel_id === im.id
                      const bairro = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
                      return (
                        <button key={im.id} type="button" onClick={() => onEscolherImovel(im.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                            sel ? 'border-violet-700 bg-violet-50' : 'border-gray-100 hover:border-violet-300'
                          }`}>
                          <p className="text-sm font-semibold text-gray-900">{im.titulo}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {bairro?.nome ?? '—'}
                            {im.endereco_resumido && ` · ${im.endereco_resumido}`}
                            {' · '}
                            <span className="text-violet-700 font-medium">{fmtBRL(im.preco)}</span>
                          </p>
                        </button>
                      )
                    })}

                    {ocupados.length > 0 && (
                      <>
                        <div className="pt-3 mt-3 border-t border-gray-100">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                            Indisponíveis ({ocupados.length}) — já com contrato ativo
                          </p>
                        </div>
                        {ocupados.map(im => {
                          const bairro = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
                          return (
                            <div
                              key={im.id}
                              className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                              title={`Imóvel já vinculado ao contrato ${im.contrato_vigente_codigo}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-700">{im.titulo}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {bairro?.nome ?? '—'}
                                    {im.endereco_resumido && ` · ${im.endereco_resumido}`}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded shrink-0">
                                  {im.contrato_vigente_codigo}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {/* Etapa 2 — Pessoas */}
      {etapa === 2 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Quem são as partes?</h2>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Inquilino *</label>
            <select value={s.inquilino_id} onChange={e => setField('inquilino_id', e.target.value)} className={inputCls}>
              <option value="">— escolha —</option>
              {inquilinos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.cpf_cnpj ? ` (${p.cpf_cnpj})` : ''}</option>)}
            </select>
            {inquilinos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhum inquilino cadastrado. <Link href="/painel/clientes/novo" className="underline">Cadastrar agora →</Link>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Proprietário *</label>
            <select value={s.proprietario_id} onChange={e => setField('proprietario_id', e.target.value)} className={inputCls}>
              <option value="">— escolha —</option>
              {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome}{p.cpf_cnpj ? ` (${p.cpf_cnpj})` : ''}</option>)}
            </select>
            {proprietarios.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhum proprietário cadastrado. <Link href="/painel/clientes/novo" className="underline">Cadastrar agora →</Link>
              </p>
            )}
            {imovelSel?.proprietario_id && s.proprietario_id === imovelSel.proprietario_id && (
              <p className="text-xs text-green-600 mt-1">✓ Proprietário pré-selecionado (vinculado a este imóvel)</p>
            )}
            {imovelSel && !imovelSel.proprietario_id && s.proprietario_id && (
              <p className="text-xs text-violet-600 mt-1">🔗 Este imóvel ficará vinculado a {proprietarios.find(p => p.id === s.proprietario_id)?.nome ?? 'esse proprietário'} após criar o contrato.</p>
            )}
          </div>
        </section>
      )}

      {/* Etapa 3 — Perfil (atuação, mobília, pet) */}
      {etapa === 3 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-6">
          <h2 className="text-base font-semibold text-gray-900">Perfil do contrato</h2>

          {/* Tipo de atuação */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Qual o seu papel nesta locação?</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {([
                { v: 'administracao', l: 'Vou administrar', d: 'Cobro aluguel, presto contas, gerencio reparos.' },
                { v: 'intermediacao', l: 'Só intermediei',  d: 'Aproximei as partes; depois eles tocam direto.' },
                { v: 'direto',        l: 'Locação direta',  d: 'Sem corretor — contrato direto locador↔locatário.' },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => setField('tipo_atuacao', o.v)}
                  className={`text-left px-3 py-3 rounded-xl border-2 transition-colors ${
                    s.tipo_atuacao === o.v ? 'border-violet-700 bg-violet-50' : 'border-gray-100 hover:border-violet-300'
                  }`}>
                  <p className={`text-sm font-medium ${s.tipo_atuacao === o.v ? 'text-violet-700' : 'text-gray-800'}`}>{o.l}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{o.d}</p>
                </button>
              ))}
            </div>
            {s.tipo_atuacao === 'intermediacao' && (
              <label className="flex items-center gap-2 mt-3 text-xs text-gray-700">
                <input type="checkbox" checked={s.intermediador_assina}
                  onChange={e => setField('intermediador_assina', e.target.checked)} />
                Intermediador assina o contrato como testemunha/parte
              </label>
            )}
          </div>

          {/* Mobília */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">Como o imóvel é entregue?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { v: 'sem',     l: 'Sem mobília'     },
                { v: 'semi',    l: 'Semi-mobiliado'  },
                { v: 'parcial', l: 'Parcial'         },
                { v: 'total',   l: '100% mobiliado'  },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => setField('tipo_mobilia', o.v)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    s.tipo_mobilia === o.v ? 'border-violet-700 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-violet-300'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>
            {s.tipo_mobilia !== 'sem' && (
              <label className="flex items-center gap-2 mt-3 text-xs text-gray-700">
                <input type="checkbox" checked={s.tem_inventario_bens}
                  onChange={e => setField('tem_inventario_bens', e.target.checked)} />
                Tenho inventário de bens anexado (recomendado)
              </label>
            )}
            {s.tipo_mobilia !== 'sem' && !s.tem_inventario_bens && (
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠ Imóvel mobiliado sem inventário — recomenda-se anexar lista com fotos antes de assinar.
              </p>
            )}
          </div>

          {/* Pet */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">O imóvel aceita pet?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { v: 'nao',          l: 'Não aceita'        },
                { v: 'sim',          l: 'Sim, aceita'       },
                { v: 'autorizacao',  l: 'Com autorização'   },
                { v: 'condominio',   l: 'Conforme condomínio' },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => setField('aceita_pet', o.v)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    s.aceita_pet === o.v ? 'border-violet-700 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-violet-300'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>
            {s.aceita_pet !== 'nao' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 block mb-1">Observação (opcional)</label>
                <input value={s.pet_observacao} onChange={e => setField('pet_observacao', e.target.value)}
                  placeholder="Ex: 1 cachorro de pequeno porte" className={inputCls} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Etapa 4 — Garantia */}
      {etapa === 4 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Qual a garantia do contrato?</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { v: 'fiador',        l: 'Fiador'        },
              { v: 'caucao',        l: 'Caução'        },
              { v: 'seguro_fianca', l: 'Seguro fiança' },
              { v: 'sem_garantia',  l: 'Sem garantia'  },
            ] as const).map(g => (
              <button key={g.v} type="button" onClick={() => setField('garantia_tipo', g.v)}
                className={`px-3 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  s.garantia_tipo === g.v ? 'border-violet-700 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-violet-300'
                }`}>
                {g.l}
              </button>
            ))}
          </div>

          {s.garantia_tipo === 'fiador' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fiador *</label>
              <select value={s.fiador_id} onChange={e => setField('fiador_id', e.target.value)} className={inputCls}>
                <option value="">— escolha —</option>
                {fiadores.map(p => <option key={p.id} value={p.id}>{p.nome}{p.cpf_cnpj ? ` (${p.cpf_cnpj})` : ''}</option>)}
              </select>
              {fiadores.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Nenhum fiador cadastrado. <Link href="/painel/clientes/novo" className="underline">Cadastrar →</Link>
                </p>
              )}
            </div>
          )}

          {s.garantia_tipo === 'caucao' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Valor da caução *</label>
              <InputMoeda value={s.caucao_valor} onChange={v => setField('caucao_valor', v)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">Geralmente 3 aluguéis. Pode ser depositado em poupança vinculada.</p>
            </div>
          )}

          {s.garantia_tipo === 'seguro_fianca' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Seguradora *</label>
                <input value={s.seguro_fianca_seguradora} onChange={e => setField('seguro_fianca_seguradora', e.target.value)} placeholder="Porto Seguro, etc." className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nº da Apólice *</label>
                <input value={s.seguro_fianca_apolice} onChange={e => setField('seguro_fianca_apolice', e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Etapa 5 — Valores */}
      {etapa === 5 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Valores e prazos</h2>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Aluguel *</label>
              <InputMoeda value={s.valor_aluguel} onChange={v => setField('valor_aluguel', v)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Seguro fiança mensal</label>
              <InputMoeda value={s.valor_seguro_fianca_mensal} onChange={v => setField('valor_seguro_fianca_mensal', v)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">Soma no boleto do inquilino</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">IPTU mensal</label>
              <InputMoeda value={s.iptu_mensal} onChange={v => setField('iptu_mensal', v)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Condomínio mensal</label>
              <InputMoeda value={s.condominio_mensal} onChange={v => setField('condominio_mensal', v)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Seguro incêndio anual</label>
              <InputMoeda value={s.valor_seguro_incendio_anual} onChange={v => setField('valor_seguro_incendio_anual', v)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">Pago 1x, não entra no boleto mensal</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Data do seguro incêndio</label>
              <input type="date" value={s.seguro_incendio_data} onChange={e => setField('seguro_incendio_data', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-50 space-y-3">
            <p className="text-xs font-medium text-gray-600">Taxa de administração da imobiliária</p>

            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => setField('taxa_admin_tipo', 'percentual')}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  s.taxa_admin_tipo === 'percentual' ? 'border-violet-700 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-violet-300'
                }`}>
                Percentual sobre o aluguel (%)
              </button>
              <button type="button"
                onClick={() => setField('taxa_admin_tipo', 'fixo')}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  s.taxa_admin_tipo === 'fixo' ? 'border-violet-700 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600 hover:border-violet-300'
                }`}>
                Valor fixo em R$
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  {s.taxa_admin_tipo === 'percentual' ? 'Quanto % sobre o aluguel?' : 'Quanto em reais por parcela?'}
                </label>
                {s.taxa_admin_tipo === 'percentual' ? (
                  <InputPercentual value={s.taxa_admin_valor} onChange={v => setField('taxa_admin_valor', v)} className={inputCls} />
                ) : (
                  <InputMoeda value={s.taxa_admin_valor} onChange={v => setField('taxa_admin_valor', v)} className={inputCls} />
                )}
              </div>
              <div className="text-xs text-gray-500">
                Exemplo: aluguel de R$ 1.900 com {s.taxa_admin_tipo === 'percentual' ? (parsePercentual(s.taxa_admin_valor) || 10) + '%' : 'R$ ' + (parseMoney(s.taxa_admin_valor) || 0).toFixed(2)}
                {' → comissão de '}
                <strong className="text-violet-700">
                  R$ {(s.taxa_admin_tipo === 'percentual'
                    ? (1900 * (parsePercentual(s.taxa_admin_valor) || 10)) / 100
                    : parseMoney(s.taxa_admin_valor)
                  ).toFixed(2).replace('.', ',')}
                </strong>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <input type="checkbox" checked={s.primeira_parcela_cheia} onChange={e => setField('primeira_parcela_cheia', e.target.checked)}
                className="w-4 h-4 rounded accent-violet-600 mt-0.5 shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>1ª parcela 100% pra imobiliária</strong>
                <p className="text-xs text-gray-500 mt-0.5">No primeiro mês, todo o aluguel fica com a imobiliária (proprietário recebe R$ 0).</p>
              </span>
            </label>
          </div>

          <div className="grid sm:grid-cols-4 gap-3 pt-3 border-t border-gray-50">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Início *</label>
              <input type="date" value={s.data_inicio} onChange={e => setField('data_inicio', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">1º aluguel *</label>
              <input type="date" value={s.data_primeiro_aluguel} onChange={e => setField('data_primeiro_aluguel', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Duração (meses) *</label>
              <input value={s.duracao_meses} onChange={e => setField('duracao_meses', e.target.value)} placeholder="12" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Dia vencimento *</label>
              <input value={s.dia_vencimento} onChange={e => setField('dia_vencimento', e.target.value)} placeholder="5" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Forma pagamento</label>
              <select value={s.forma_pagamento} onChange={e => setField('forma_pagamento', e.target.value as WizardState['forma_pagamento'])} className={inputCls}>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Índice reajuste</label>
              <select value={s.indice_reajuste} onChange={e => setField('indice_reajuste', e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="IGPM">IGP-M</option>
                <option value="IPCA">IPCA</option>
                <option value="INPC">INPC</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Próximo reajuste</label>
              <input type="date" value={s.data_proximo_reajuste} onChange={e => setField('data_proximo_reajuste', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-50">
            <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
            <textarea value={s.observacoes} onChange={e => setField('observacoes', e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Notas internas..." />
          </div>
        </section>
      )}

      {/* Etapa 6 — Revisão */}
      {etapa === 6 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileSignature size={18} className="text-violet-600" />
            Revisão antes de salvar
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Imóvel</p>
              <p className="font-semibold text-gray-900">{imovelSel?.titulo ?? '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Inquilino</p>
              <p className="font-semibold text-gray-900">{pessoas.find(p => p.id === s.inquilino_id)?.nome ?? '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Proprietário</p>
              <p className="font-semibold text-gray-900">{pessoas.find(p => p.id === s.proprietario_id)?.nome ?? '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Garantia</p>
              <p className="font-semibold text-gray-900 capitalize">
                {s.garantia_tipo === 'sem_garantia' ? 'Sem garantia' : s.garantia_tipo.replace('_', ' ')}
                {s.garantia_tipo === 'fiador' && ` · ${pessoas.find(p => p.id === s.fiador_id)?.nome ?? '—'}`}
                {s.garantia_tipo === 'caucao' && ` · ${fmtBRL(parseNumero(s.caucao_valor))}`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Atuação</p>
              <p className="font-semibold text-gray-900">
                {s.tipo_atuacao === 'administracao' && 'Administração imobiliária'}
                {s.tipo_atuacao === 'intermediacao' && `Intermediação${s.intermediador_assina ? ' (assina)' : ''}`}
                {s.tipo_atuacao === 'direto' && 'Locação direta'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Mobília</p>
              <p className="font-semibold text-gray-900">
                {s.tipo_mobilia === 'sem' && 'Sem mobília'}
                {s.tipo_mobilia === 'semi' && 'Semi-mobiliado'}
                {s.tipo_mobilia === 'parcial' && 'Parcialmente mobiliado'}
                {s.tipo_mobilia === 'total' && '100% mobiliado'}
                {s.tipo_mobilia !== 'sem' && s.tem_inventario_bens && ' · com inventário'}
                {s.tipo_mobilia !== 'sem' && !s.tem_inventario_bens && ' · sem inventário ⚠'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Pet</p>
              <p className="font-semibold text-gray-900">
                {s.aceita_pet === 'nao' && 'Não aceita'}
                {s.aceita_pet === 'sim' && 'Aceita'}
                {s.aceita_pet === 'autorizacao' && 'Com autorização'}
                {s.aceita_pet === 'condominio' && 'Conforme condomínio'}
                {s.pet_observacao && ` · ${s.pet_observacao}`}
              </p>
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-violet-700">Parcelas</p>
              <p className="text-xl font-bold text-violet-900">{previewParcelas.length}</p>
            </div>
            <div>
              <p className="text-xs text-violet-700">Total a receber</p>
              <p className="text-xl font-bold text-violet-900">{fmtBRL(resumo.total_a_receber)}</p>
            </div>
            <div>
              <p className="text-xs text-violet-700">Comissão total</p>
              <p className="text-xl font-bold text-violet-900">{fmtBRL(resumo.total_comissao)}</p>
            </div>
            <div>
              <p className="text-xs text-violet-700">Repasse total</p>
              <p className="text-xl font-bold text-violet-900">{fmtBRL(resumo.total_repasse)}</p>
            </div>
          </div>

          {/* Preview das parcelas */}
          {previewParcelas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parcelas que serão geradas</p>
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Vencimento</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Boleto</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Comissão</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Repasse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewParcelas.map(p => (
                      <tr key={p.numero} className="border-t border-gray-50">
                        <td className="px-3 py-1.5 text-gray-500">{p.numero}</td>
                        <td className="px-3 py-1.5 text-gray-700">{new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-gray-900">{fmtBRL(p.valor_total)}</td>
                        <td className="px-3 py-1.5 text-right text-violet-700">{fmtBRL(p.valor_comissao)}</td>
                        <td className="px-3 py-1.5 text-right text-green-700">{fmtBRL(p.valor_repasse_proprietario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={voltar}
          disabled={etapa === 1 || isPending}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-30"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        {etapa < ETAPAS.length ? (
          <button
            type="button"
            onClick={avancar}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Avançar <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={salvar}
            disabled={isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Criar contrato + gerar parcelas
          </button>
        )}
      </div>
    </div>
  )
}
