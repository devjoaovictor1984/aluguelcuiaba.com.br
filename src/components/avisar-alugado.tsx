'use client'

import { useState } from 'react'
import { Flag, X, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AvisarAlugado({ imovelId }: { imovelId: string }) {
  const [open, setOpen] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleEnviar = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('avisos_alugado').insert({ imovel_id: imovelId })
    setEnviado(true)
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mx-auto"
      >
        <Flag size={12} />
        Este imóvel já foi alugado?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Avisar sobre este imóvel</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>

            {enviado ? (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 mb-1">Obrigado pelo aviso!</p>
                <p className="text-sm text-gray-500">
                  Vamos verificar e entrar em contato com o anunciante.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 text-sm text-violet-600 font-medium hover:underline"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  Conversou com o anunciante e soube que o imóvel já está alugado?
                  Avise nossa equipe para atualizarmos o anúncio.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEnviar}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Flag size={14} />}
                    Confirmar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
