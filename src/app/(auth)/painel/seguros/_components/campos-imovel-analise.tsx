'use client'

import { ChevronDown, Info } from 'lucide-react'
import { maskCep, maskMoney } from '@/lib/formatters'
import { TIPOS_IMOVEL_COMERCIAL, TIPOS_IMOVEL_RESIDENCIAL } from '@/lib/seguros/tabelas'

export interface CamposImovel {
  cep: string
  logradouro: string
  aluguel: string
  condominio: string
  iptu: string
  agua: string
  energia: string
  gas: string
  finalidade: 'R' | 'C'
  tipo: string
  meses: string
  pinturaNova: boolean
}

export const IMOVEL_VAZIO: CamposImovel = {
  cep: '', logradouro: '', aluguel: '', condominio: '', iptu: '',
  agua: '', energia: '', gas: '',
  finalidade: 'R', tipo: '', meses: '30', pinturaNova: true,
}

/**
 * Períodos usuais de contrato de locação.
 *
 * A corretora usa lista fechada; deixamos "outro" pra não travar caso
 * apareça prazo fora do padrão.
 */
const PERIODOS = ['12', '24', '30', '36', '48', '60']

interface Props {
  valores: CamposImovel
  onChange: (v: Partial<CamposImovel>) => void
  inputCls: string
  disabled?: boolean
}

/**
 * Dados do imóvel para a análise de fiança.
 *
 * Compartilhado entre a cotação direta e a geração de link, porque a API
 * pede exatamente os mesmos campos nos dois caminhos.
 *
 * Água, luz e gás não são opcionais por capricho: eles compõem o valor
 * que o seguro cobre. Declarar a menos faz a seguradora aprovar um limite
 * que não cobre a obrigação real do inquilino.
 */
export function CamposImovelAnalise({ valores: v, onChange, inputCls, disabled }: Props) {
  const label = 'text-xs font-medium text-gray-600 block mb-1'
  const tipos = v.finalidade === 'R' ? TIPOS_IMOVEL_RESIDENCIAL : TIPOS_IMOVEL_COMERCIAL
  const periodoForaDaLista = !PERIODOS.includes(v.meses)

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className={label}>CEP <span className="text-red-500">*</span></label>
          <input
            value={v.cep}
            onChange={e => onChange({ cep: maskCep(e.target.value) })}
            disabled={disabled}
            inputMode="numeric"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Logradouro</label>
          <input
            value={v.logradouro}
            onChange={e => onChange({ logradouro: e.target.value })}
            disabled={disabled}
            placeholder="Rua, avenida…"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Finalidade</label>
          <div className="relative">
            <select
              value={v.finalidade}
              onChange={e => onChange({ finalidade: e.target.value as 'R' | 'C', tipo: '' })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="R">Residencial</option>
              <option value="C">Comercial</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={label}>Tipo do imóvel</label>
          <div className="relative">
            <select
              value={v.tipo}
              onChange={e => onChange({ tipo: e.target.value })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="">—</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Encargos: compõem o valor coberto */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1.5">
          Aluguel e encargos <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            ['Aluguel', 'aluguel'],
            ['Condomínio', 'condominio'],
            ['IPTU', 'iptu'],
            ['Água', 'agua'],
            ['Luz', 'energia'],
            ['Gás', 'gas'],
          ] as const).map(([rotulo, campo]) => (
            <div key={campo}>
              <label className={label}>{rotulo}</label>
              <input
                value={v[campo]}
                onChange={e => onChange({ [campo]: maskMoney(e.target.value) })}
                disabled={disabled}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5 flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
          Os encargos entram no valor que o seguro cobre. Informar a menos faz a
          seguradora aprovar um limite que não cobre a obrigação real.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Período do contrato</label>
          <div className="relative">
            <select
              value={periodoForaDaLista ? 'outro' : v.meses}
              onChange={e => onChange({ meses: e.target.value === 'outro' ? '' : e.target.value })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              {PERIODOS.map(m => <option key={m} value={m}>{m} meses</option>)}
              <option value="outro">Outro…</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {periodoForaDaLista && (
            <input
              value={v.meses}
              onChange={e => onChange({ meses: e.target.value.replace(/\D/g, '') })}
              disabled={disabled}
              inputMode="numeric"
              placeholder="meses"
              className={`${inputCls} mt-1.5`}
            />
          )}
        </div>

        <div>
          <label className={label}>
            Pintura nova <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={v.pinturaNova ? '1' : '0'}
              onChange={e => onChange({ pinturaNova: e.target.value === '1' })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="1">Sim — imóvel entregue pintado</option>
              <option value="0">Não</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Converte os campos mascarados no formato do domínio. */
export function montarImovel(v: CamposImovel, parseMoney: (s: string) => number) {
  return {
    cep: v.cep,
    endereco: v.logradouro.trim() || null,
    aluguel: parseMoney(v.aluguel),
    condominio: parseMoney(v.condominio) || null,
    iptu: parseMoney(v.iptu) || null,
    agua: parseMoney(v.agua) || null,
    energia: parseMoney(v.energia) || null,
    gas: parseMoney(v.gas) || null,
    finalidade: v.finalidade,
    tipo: v.tipo || null,
    periodoContratoMeses: parseInt(v.meses, 10) || 30,
    pinturaNova: v.pinturaNova,
  }
}

/** Valida o mínimo. Devolve mensagem ou null. */
export function validarImovel(v: CamposImovel, parseMoney: (s: string) => number): string | null {
  if (v.cep.replace(/\D/g, '').length !== 8) return 'CEP inválido.'
  if (parseMoney(v.aluguel) <= 0) return 'Informe o valor do aluguel.'
  if (!parseInt(v.meses, 10)) return 'Informe o período do contrato.'
  return null
}
