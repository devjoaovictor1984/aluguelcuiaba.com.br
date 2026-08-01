'use client'

import { Plus, X, Users } from 'lucide-react'
import { maskCpfCnpj } from '@/lib/formatters'

export interface SolidarioCampo {
  nome: string
  cpf: string
  dataNascimento: string
}

export const SOLIDARIO_VAZIO: SolidarioCampo = { nome: '', cpf: '', dataNascimento: '' }

interface Props {
  valores: SolidarioCampo[]
  onChange: (v: SolidarioCampo[]) => void
  inputCls: string
  disabled?: boolean
}

const MAXIMO = 3

/**
 * Locatários solidários — quem compõe renda com o pretendente.
 *
 * É a saída padrão quando a seguradora aprova com limite abaixo do
 * pedido: a própria mensagem dela diz "será necessário incluir um
 * locatário solidário para aumento de limite". Sem esta tela o corretor
 * lê a recusa parcial e não tem o que fazer.
 *
 * A API aceita no máximo 3 (campo `numSolidarios`).
 */
export function CamposSolidarios({ valores, onChange, inputCls, disabled }: Props) {
  const adicionar = () => {
    if (valores.length >= MAXIMO) return
    onChange([...valores, { ...SOLIDARIO_VAZIO }])
  }

  const remover = (i: number) => onChange(valores.filter((_, idx) => idx !== i))

  const atualizar = (i: number, campo: keyof SolidarioCampo, valor: string) => {
    onChange(valores.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)))
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Users size={14} className="text-violet-600" /> Locatários solidários
          </p>
          <p className="text-[11px] text-gray-400 leading-tight">
            Quem compõe renda com o pretendente. Aumenta o limite aprovado.
            Até {MAXIMO}.
          </p>
        </div>
        {valores.length < MAXIMO && (
          <button
            type="button"
            onClick={adicionar}
            disabled={disabled}
            className="shrink-0 flex items-center gap-1 rounded-lg ring-1 ring-gray-200 hover:ring-violet-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
          >
            <Plus size={12} /> Incluir
          </button>
        )}
      </div>

      {valores.map((s, i) => (
        <div key={i} className="rounded-xl bg-gray-50 p-3 space-y-2.5 relative">
          <button
            type="button"
            onClick={() => remover(i)}
            disabled={disabled}
            aria-label={`Remover solidário ${i + 1}`}
            className="absolute top-2 right-2 text-gray-400 hover:text-rose-600 disabled:opacity-50"
          >
            <X size={14} />
          </button>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              value={s.nome}
              onChange={e => atualizar(i, 'nome', e.target.value)}
              disabled={disabled}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                CPF <span className="text-red-500">*</span>
              </label>
              <input
                value={s.cpf}
                onChange={e => atualizar(i, 'cpf', maskCpfCnpj(e.target.value))}
                disabled={disabled}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Nascimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={s.dataNascimento}
                onChange={e => atualizar(i, 'dataNascimento', e.target.value)}
                disabled={disabled}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Valida e converte pro formato do domínio. Devolve erro legível ou os dados. */
export function validarSolidarios(
  valores: SolidarioCampo[],
): { erro: string } | { solidarios: { nome: string; cpf: string; dataNascimento: string }[] } {
  const preenchidos = valores.filter(s => s.nome.trim() || s.cpf.trim() || s.dataNascimento)

  for (const [i, s] of preenchidos.entries()) {
    const n = i + 1
    if (!s.nome.trim()) return { erro: `Informe o nome do solidário ${n}.` }
    if (s.cpf.replace(/\D/g, '').length !== 11) return { erro: `CPF do solidário ${n} incompleto.` }
    if (!s.dataNascimento) return { erro: `Informe a data de nascimento do solidário ${n}.` }
  }

  return {
    solidarios: preenchidos.map(s => ({
      nome: s.nome.trim(),
      cpf: s.cpf,
      dataNascimento: s.dataNascimento,
    })),
  }
}
