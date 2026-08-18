'use client'

import { useState } from 'react'
import { AlertTriangle, X, Send, Loader2, Mail, ShieldCheck } from 'lucide-react'

/**
 * A última parada antes de o contrato virar link de assinatura.
 *
 * Assinatura é irreversível na prática: o cliente lê, assina, e o que
 * estiver errado no texto já foi lido por ele. Cancelar depois custa
 * credibilidade com quem está do outro lado.
 *
 * A confirmação NÃO é só um "tem certeza?". Um "tem certeza?" vira
 * reflexo em duas semanas e para de ser lido. O que pega erro de verdade
 * é ver os dados: o e-mail trocado entre duas partes, o signatário que
 * ficou de fora, o OTP desligado sem querer. Por isso o quadro mostra
 * para quem vai, e o aceite é uma frase só, sobre o que ninguém além do
 * corretor pode conferir — o texto das cláusulas.
 */

interface Signatario { nome: string; email: string; papel: string }

export function ConfirmarEnvioAssinatura({ signatarios, exigirOtp, enviando, onConfirmar, onCancelar }: {
  signatarios: Signatario[]
  exigirOtp: boolean
  enviando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const [conferi, setConferi] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Antes de enviar</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Depois disso o cliente recebe o link e lê o contrato como ele está.
            </p>
          </div>
          <button type="button" onClick={onCancelar} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Para quem vai — é aqui que aparece o e-mail errado */}
          <div className="rounded-xl ring-1 ring-gray-100 divide-y divide-gray-50">
            {signatarios.map((s, i) => (
              <div key={i} className="px-3 py-2.5">
                <p className="text-sm font-semibold text-gray-900">
                  {s.nome}
                  {s.papel && <span className="font-normal text-gray-500"> · {s.papel}</span>}
                </p>
                <p className="text-[11px] text-gray-600 flex items-center gap-1 mt-0.5">
                  <Mail size={10} className="text-gray-400" /> {s.email}
                </p>
              </div>
            ))}
          </div>

          <p className={`text-[11px] rounded-lg px-3 py-2 flex items-start gap-1.5 leading-snug ${
            exigirOtp ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}>
            <ShieldCheck size={11} className="mt-0.5 shrink-0" />
            {exigirOtp
              ? 'Cada parte confirma um código enviado ao e-mail antes de assinar.'
              : 'O código por e-mail está DESLIGADO — a pessoa assina só com selfie e assinatura. Se não foi de propósito, feche e marque a opção.'}
          </p>

          <div className="rounded-xl bg-gray-50 px-3 py-3">
            <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-600" />
              O que só você pode conferir
            </p>
            <ul className="text-[11px] text-gray-600 leading-snug mt-1.5 space-y-1 list-disc pl-4">
              <li>o prazo, o valor do aluguel e a data de início</li>
              <li>a cláusula de garantia — é a que mais muda de um contrato pro outro</li>
              <li>as cláusulas que você editou ou adicionou à mão</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 cursor-pointer rounded-xl ring-1 ring-violet-200 bg-violet-50 px-3 py-3">
            <input
              type="checkbox"
              checked={conferi}
              onChange={e => setConferi(e.target.checked)}
              className="mt-0.5 accent-violet-600 shrink-0"
            />
            <span className="text-xs text-violet-900 leading-snug">
              Li o contrato gerado e conferi as cláusulas. Estou ciente de que o
              cliente vai lê-lo exatamente como está.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="flex-1 rounded-xl ring-1 ring-gray-200 hover:bg-gray-50 py-3 text-sm font-semibold text-gray-700"
            >
              Voltar e revisar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={!conferi || enviando}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 py-3 text-sm font-bold text-white"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
