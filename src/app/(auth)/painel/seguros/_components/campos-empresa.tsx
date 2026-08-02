'use client'

import { Building2, ChevronDown, Info } from 'lucide-react'
import { maskCpfCnpj, maskMoney } from '@/lib/formatters'
import {
  FRANQUEADORAS, OPCOES_TRIBUTARIAS, RAMOS_ATIVIDADE, TIPOS_EMPRESA,
} from '@/lib/seguros/tabelas'
import { SeletorCnae } from './seletor-cnae'

export interface CamposEmpresa {
  cnae: string
  cnaeDescricao: string
  capitalInicial: string
  capitalGiro: string
  capitalSocial: string
  tipoEmpresa: string
  opcaoTributaria: string
  empresaMais2anos: boolean

  empresaConstituida: boolean
  cnpjEmpresaConstituida: string
  ramoAtividade: string
  ehFranquia: boolean
  franqueadoraCodigo: string
}

export const EMPRESA_VAZIA: CamposEmpresa = {
  cnae: '', cnaeDescricao: '', capitalInicial: '', capitalGiro: '', capitalSocial: '',
  tipoEmpresa: '', opcaoTributaria: '', empresaMais2anos: false,
  empresaConstituida: false, cnpjEmpresaConstituida: '', ramoAtividade: '',
  ehFranquia: false, franqueadoraCodigo: '',
}

interface Props {
  valores: CamposEmpresa
  onChange: (v: Partial<CamposEmpresa>) => void
  inputCls: string
  disabled?: boolean
}

/**
 * Dados de empresa — exigidos quando o imóvel é comercial.
 *
 * A análise reduzida não existe pra comercial: a API pede CNAE, capitais
 * e ramo de atividade, e a locação para empresa constituída ou franquia
 * abre campos próprios.
 */
export function CamposEmpresa({ valores: v, onChange, inputCls, disabled }: Props) {
  const label = 'text-xs font-medium text-gray-600 block mb-1'

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Building2 size={14} className="text-violet-600" /> Dados da empresa
        </p>
        <p className="text-[11px] text-gray-400 leading-tight">
          Obrigatórios para locação comercial.
        </p>
      </div>

      <div>
        <label className={label}>
          Atividade (CNAE) <span className="text-red-500">*</span>
        </label>
        <SeletorCnae
          valor={v.cnae}
          descricao={v.cnaeDescricao}
          onChange={(id, descricao) => onChange({ cnae: id, cnaeDescricao: descricao })}
          inputCls={inputCls}
          disabled={disabled}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Ramo de atividade</label>
          <div className="relative">
            <select
              value={v.ramoAtividade}
              onChange={e => onChange({ ramoAtividade: e.target.value })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="">—</option>
              {RAMOS_ATIVIDADE.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={label}>Tipo de empresa</label>
          <div className="relative">
            <select
              value={v.tipoEmpresa}
              onChange={e => onChange({ tipoEmpresa: e.target.value })}
              disabled={disabled}
              className={`${inputCls} appearance-none pr-8`}
            >
              <option value="">—</option>
              {TIPOS_EMPRESA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className={label}>Opção tributária</label>
        <div className="relative">
          <select
            value={v.opcaoTributaria}
            onChange={e => onChange({ opcaoTributaria: e.target.value })}
            disabled={disabled}
            className={`${inputCls} appearance-none pr-8`}
          >
            <option value="">—</option>
            {OPCOES_TRIBUTARIAS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {([
          ['Capital inicial *', 'capitalInicial'],
          ['Capital de giro *', 'capitalGiro'],
          ['Capital social', 'capitalSocial'],
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

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={v.empresaMais2anos}
          onChange={e => onChange({ empresaMais2anos: e.target.checked })}
          disabled={disabled}
          className="accent-violet-600"
        />
        <span className="text-sm text-gray-700">Empresa com mais de 2 anos</span>
      </label>

      {/* Locação para empresa já constituída */}
      <div className="pt-2 border-t border-gray-50 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={v.empresaConstituida}
            onChange={e => onChange({ empresaConstituida: e.target.checked })}
            disabled={disabled}
            className="accent-violet-600"
          />
          <span className="text-sm text-gray-700">
            A locação é para empresa já constituída
          </span>
        </label>

        {v.empresaConstituida && (
          <div>
            <label className={label}>CNPJ da empresa</label>
            <input
              value={v.cnpjEmpresaConstituida}
              onChange={e => onChange({ cnpjEmpresaConstituida: maskCpfCnpj(e.target.value) })}
              disabled={disabled}
              inputMode="numeric"
              className={inputCls}
            />
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={v.ehFranquia}
            onChange={e => onChange({ ehFranquia: e.target.checked })}
            disabled={disabled}
            className="accent-violet-600"
          />
          <span className="text-sm text-gray-700">Trata-se de franquia</span>
        </label>

        {v.ehFranquia && (
          <div>
            <label className={label}>Franqueadora</label>
            <div className="relative">
              <select
                value={v.franqueadoraCodigo}
                onChange={e => onChange({ franqueadoraCodigo: e.target.value })}
                disabled={disabled}
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="">—</option>
                {FRANQUEADORAS.map(f => (
                  <option key={f.codigo} value={f.codigo}>{f.nome}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0" />
              Marca fora da lista: escolha &ldquo;Outra&rdquo;.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Valida o mínimo exigido pela API em locação comercial. */
export function validarEmpresa(
  v: CamposEmpresa,
  parseMoney: (s: string) => number,
): string | null {
  if (!v.cnae) return 'Escolha a atividade (CNAE) da empresa.'
  if (parseMoney(v.capitalInicial) <= 0) return 'Informe o capital inicial.'
  if (parseMoney(v.capitalGiro) <= 0) return 'Informe o capital de giro.'
  if (v.empresaConstituida && v.cnpjEmpresaConstituida.replace(/\D/g, '').length !== 14) {
    return 'CNPJ da empresa constituída incompleto.'
  }
  if (v.ehFranquia && !v.franqueadoraCodigo) return 'Escolha a franqueadora.'
  return null
}
