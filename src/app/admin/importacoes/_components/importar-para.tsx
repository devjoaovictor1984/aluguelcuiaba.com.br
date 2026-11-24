'use client'

import { useMemo, useState } from 'react'
import { NovaImportacao } from '@/app/(auth)/painel/anuncios/importar/_components/nova-importacao'

type Conta = { id: string; nome: string; email: string; tipo: string | null }

/** Admin: escolhe a conta que vai receber os imóveis e importa para ela. */
export function ImportarPara({ contas }: { contas: Conta[] }) {
  const [busca, setBusca] = useState('')
  const [alvo, setAlvo] = useState<Conta | null>(null)

  const achados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q.length < 2) return []
    return contas.filter(c => c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 12)
  }, [busca, contas])

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Importar para uma conta</h2>
      <p className="text-xs text-gray-500 mb-3">
        Os imóveis nascem na conta escolhida (como se ela tivesse importado). O limite do plano dela vale, a não ser que você marque para ignorar.
      </p>

      {alvo ? (
        <>
          <div className="flex items-center justify-between gap-3 bg-violet-50 rounded-lg px-3 py-2 mb-3">
            <span className="text-sm"><strong>{alvo.nome}</strong> <span className="text-gray-500">{alvo.email}</span></span>
            <button onClick={() => setAlvo(null)} className="text-xs text-violet-700 font-semibold">Trocar</button>
          </div>
          <NovaImportacao alvoUserId={alvo.id} />
        </>
      ) : (
        <>
          <input
            type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {achados.length > 0 && (
            <ul className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-100">
              {achados.map(c => (
                <li key={c.id}>
                  <button onClick={() => setAlvo(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    {c.nome} <span className="text-gray-400 text-xs">{c.email}{c.tipo ? ` · ${c.tipo}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
