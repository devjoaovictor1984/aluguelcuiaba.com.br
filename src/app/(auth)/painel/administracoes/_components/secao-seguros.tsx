'use client'

import { ShieldCheck, Flame, Info } from 'lucide-react'
import {
  GARANTIAS, GARANTIA_LABEL, MODOS_SEGURO_INCENDIO,
  MODO_INCENDIO_AJUDA, MODO_INCENDIO_LABEL, type ModoSeguroIncendio,
} from '@/lib/seguros/preferencia-proprietario'

export interface ValoresSeguros {
  seguro_incendio_modo: ModoSeguroIncendio
  seguro_incendio_pagador: 'proprietario' | 'inquilino' | ''
  seguro_incendio_seguradora: string
  seguro_incendio_apolice: string
  seguro_incendio_vencimento: string
  garantias_aceitas: string[]
  autoriza_cotacao_seguros: boolean
  seguros_observacoes: string
}

export const SEGUROS_PADRAO: ValoresSeguros = {
  seguro_incendio_modo: 'a_definir',
  seguro_incendio_pagador: '',
  seguro_incendio_seguradora: '',
  seguro_incendio_apolice: '',
  seguro_incendio_vencimento: '',
  garantias_aceitas: [],
  autoriza_cotacao_seguros: false,
  seguros_observacoes: '',
}

interface Props {
  valores: ValoresSeguros
  onChange: (v: Partial<ValoresSeguros>) => void
  inputCls: string
}

/**
 * O que perguntar ao proprietário sobre seguros, no contrato de
 * administração — onde a autorização dele vira cláusula.
 *
 * Compartilhado entre criar e editar administração.
 */
export function SecaoSeguros({ valores: v, onChange, inputCls }: Props) {
  const proprietarioTem = v.seguro_incendio_modo === 'proprietario_possui'
  const administradoraContrata = v.seguro_incendio_modo === 'administradora_contrata'
  const dispensado = v.seguro_incendio_modo === 'dispensado'
  const temModo = v.seguro_incendio_modo !== 'a_definir'

  const toggleGarantia = (g: string) => {
    const atual = v.garantias_aceitas
    onChange({
      garantias_aceitas: atual.includes(g)
        ? atual.filter(x => x !== g)
        : [...atual, g],
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-violet-600" /> Seguros
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          O que combinar com o proprietário. Define o que o sistema vai poder
          fazer depois — e o que entra como cláusula no contrato.
        </p>
      </div>

      {/* ── Incêndio ── */}
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
            <Flame size={12} className="text-orange-500" /> Seguro incêndio
          </span>
          <select
            value={v.seguro_incendio_modo}
            onChange={e => onChange({ seguro_incendio_modo: e.target.value as ModoSeguroIncendio })}
            className={inputCls}
          >
            {MODOS_SEGURO_INCENDIO.map(m => (
              <option key={m} value={m}>{MODO_INCENDIO_LABEL[m]}</option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-gray-500 leading-snug flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
          {MODO_INCENDIO_AJUDA[v.seguro_incendio_modo]}
        </p>

        {dispensado && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            <strong>Atenção:</strong> a Lei do Inquilinato (art. 22, VIII) põe o
            prêmio do seguro contra fogo como obrigação do locador. Dispensar é
            decisão dele — deixe registrado nas observações.
          </p>
        )}

        {proprietarioTem && (
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 block mb-1">Seguradora</span>
              <input
                value={v.seguro_incendio_seguradora}
                onChange={e => onChange({ seguro_incendio_seguradora: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 block mb-1">Apólice</span>
              <input
                value={v.seguro_incendio_apolice}
                onChange={e => onChange({ seguro_incendio_apolice: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 block mb-1">Vence em</span>
              <input
                type="date"
                value={v.seguro_incendio_vencimento}
                onChange={e => onChange({ seguro_incendio_vencimento: e.target.value })}
                className={inputCls}
              />
            </label>
          </div>
        )}

        {temModo && !dispensado && (
          <label className="block pt-1">
            <span className="text-xs font-medium text-gray-600 block mb-1">Quem paga o prêmio</span>
            <select
              value={v.seguro_incendio_pagador}
              onChange={e => onChange({ seguro_incendio_pagador: e.target.value as 'proprietario' | 'inquilino' | '' })}
              className={inputCls}
            >
              <option value="">— a definir —</option>
              <option value="inquilino">Inquilino (repassado por cláusula)</option>
              <option value="proprietario">Proprietário</option>
            </select>
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              Por lei é do locador; o art. 25 permite repassar ao locatário. Quem
              contrata e quem paga podem ser diferentes.
            </span>
          </label>
        )}
      </div>

      {/* ── Garantias ── */}
      <div className="pt-1 border-t border-gray-50">
        <span className="text-xs font-medium text-gray-600 block mb-1.5">
          Garantias que o proprietário aceita
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GARANTIAS.map(g => {
            const ativo = v.garantias_aceitas.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGarantia(g)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  ativo
                    ? 'bg-violet-700 border-violet-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {GARANTIA_LABEL[g]}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Nenhuma marcada = sem restrição, você decide na hora da locação.
        </p>
      </div>

      {/* ── Autorização ── */}
      <label className={`flex items-start gap-2 pt-1 border-t border-gray-50 ${
        administradoraContrata ? 'cursor-pointer' : 'opacity-60 cursor-pointer'
      }`}>
        <input
          type="checkbox"
          checked={v.autoriza_cotacao_seguros}
          onChange={e => onChange({ autoriza_cotacao_seguros: e.target.checked })}
          className="accent-violet-600 mt-0.5"
        />
        <span>
          <p className="text-sm font-medium text-gray-900">
            Autoriza a administradora a cotar e contratar seguros em nome dele
          </p>
          <p className="text-[11px] text-gray-500 leading-tight">
            Sem esse aceite, o sistema não oferece o botão de contratar apólice
            para este imóvel. Deve constar no contrato assinado.
          </p>
        </span>
      </label>

      {administradoraContrata && !v.autoriza_cotacao_seguros && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          Você marcou que a administradora contrata, mas a autorização acima
          está desmarcada. Sem ela, a contratação fica bloqueada.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">
          Observações sobre seguros
        </span>
        <textarea
          value={v.seguros_observacoes}
          onChange={e => onChange({ seguros_observacoes: e.target.value })}
          rows={2}
          placeholder="Combinados específicos, prazos, quem apresenta a apólice…"
          className={`${inputCls} resize-y`}
        />
      </label>
    </section>
  )
}
