'use client'

import type { ChangeEvent, InputHTMLAttributes } from 'react'
import { maskCpfCnpj, maskTelefone, maskCep, maskMoney, maskPercentual } from '@/lib/formatters'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: string
  onChange: (next: string) => void
}

/** CPF (até 11 dígitos) ou CNPJ (14) — detecta automaticamente */
export function InputCpfCnpj({ value, onChange, ...rest }: BaseProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(maskCpfCnpj(e.target.value))}
      placeholder={rest.placeholder ?? '000.000.000-00'}
    />
  )
}

export function InputTelefone({ value, onChange, ...rest }: BaseProps) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(maskTelefone(e.target.value))}
      placeholder={rest.placeholder ?? '(65) 99999-9999'}
    />
  )
}

export function InputCep({ value, onChange, ...rest }: BaseProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(maskCep(e.target.value))}
      placeholder={rest.placeholder ?? '00000-000'}
      maxLength={9}
    />
  )
}

/** Moeda BR. Digite só números — formata automático: 190000 → 1.900,00 */
export function InputMoeda({ value, onChange, ...rest }: BaseProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">R$</span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(maskMoney(e.target.value))}
        placeholder={rest.placeholder ?? '0,00'}
        className={`${rest.className ?? ''} pl-9`}
      />
    </div>
  )
}

/** Percentual BR. Aceita 0–100 com vírgula. Ex: "10,5" */
export function InputPercentual({ value, onChange, ...rest }: BaseProps) {
  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(maskPercentual(e.target.value))}
        placeholder={rest.placeholder ?? '10'}
        className={`${rest.className ?? ''} pr-7`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
    </div>
  )
}
