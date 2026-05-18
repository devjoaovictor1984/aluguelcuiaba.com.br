'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, AlertOctagon, RotateCcw, Trash2, Loader2, Check, AlertCircle } from 'lucide-react'
import {
  enviarResetSenhaAdmin,
  banirUsuarioAdmin,
  desbanirUsuarioAdmin,
  excluirUsuarioAdmin,
} from '../actions'

interface Props {
  userId: string
  email: string
  banido: boolean
  motivoAtual: string
  ehAdmin: boolean
}

export function AcoesAdmin({ userId, email, banido, motivoAtual, ehAdmin }: Props) {
  const router = useRouter()
  const [acao, setAcao] = useState<null | 'reset' | 'banir' | 'desbanir' | 'excluir'>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [motivo, setMotivo] = useState(motivoAtual)
  const [mostrarBanir, setMostrarBanir] = useState(false)

  const resetSenha = () => {
    if (!confirm(`Enviar email de redefinição de senha para ${email}?`)) return
    setAcao('reset'); setFeedback(null)
    startTransition(async () => {
      const r = await enviarResetSenhaAdmin(userId)
      setAcao(null)
      if (r.error) setFeedback({ tipo: 'erro', msg: r.error })
      else setFeedback({ tipo: 'ok', msg: `Email enviado para ${r.email}` })
    })
  }

  const banir = () => {
    if (!confirm(`Banir este usuário? Ele NÃO conseguirá mais fazer login. Os dados (imóveis, contratos) permanecem e podem ser restaurados.`)) return
    setAcao('banir'); setFeedback(null)
    startTransition(async () => {
      const r = await banirUsuarioAdmin(userId, motivo)
      setAcao(null)
      if (r.error) { setFeedback({ tipo: 'erro', msg: r.error }); return }
      setFeedback({ tipo: 'ok', msg: 'Usuário banido. Sessão encerrada.' })
      setMostrarBanir(false)
      router.refresh()
    })
  }

  const desbanir = () => {
    if (!confirm('Reativar acesso deste usuário?')) return
    setAcao('desbanir'); setFeedback(null)
    startTransition(async () => {
      const r = await desbanirUsuarioAdmin(userId)
      setAcao(null)
      if (r.error) { setFeedback({ tipo: 'erro', msg: r.error }); return }
      setFeedback({ tipo: 'ok', msg: 'Acesso reativado.' })
      router.refresh()
    })
  }

  const excluir = () => {
    if (ehAdmin) { alert('Não dá pra excluir admin direto pela UI. Mude o role no banco antes.'); return }
    if (!confirm(`EXCLUIR DEFINITIVAMENTE este usuário?\n\nApaga: conta de login, perfil, imóveis, contratos, parcelas, documentos.\nTudo que estiver vinculado vai junto. Esta ação NÃO TEM VOLTA.\n\nConfirma?`)) return
    if (!confirm(`Última confirmação: digitar manualmente o email "${email}" no próximo prompt para apagar.`)) return
    const typed = prompt(`Digite o email exato para confirmar: ${email}`)
    if (typed?.trim().toLowerCase() !== email.toLowerCase()) {
      alert('Email não confere. Operação cancelada.')
      return
    }
    setAcao('excluir'); setFeedback(null)
    startTransition(async () => {
      const r = await excluirUsuarioAdmin(userId)
      setAcao(null)
      // Se chegou aqui, ou houve erro ou o redirect ocorreu.
      if (r?.error) setFeedback({ tipo: 'erro', msg: r.error })
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Bloco
          icone={<KeyRound size={15} />}
          cor="violet"
          titulo="Redefinir senha"
          sub="Envia email do Supabase para o usuário criar uma nova senha. Você não vê a senha."
          botao={
            <button
              type="button"
              onClick={resetSenha}
              disabled={isPending}
              className="flex items-center gap-1.5 text-sm bg-violet-700 hover:bg-violet-800 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {acao === 'reset' ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              Enviar email
            </button>
          }
        />

        {banido ? (
          <Bloco
            icone={<RotateCcw size={15} />}
            cor="green"
            titulo="Reativar conta"
            sub="Remove o bloqueio. Usuário volta a poder logar com a senha que já tinha."
            botao={
              <button
                type="button"
                onClick={desbanir}
                disabled={isPending}
                className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {acao === 'desbanir' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                Desbanir
              </button>
            }
          />
        ) : (
          <Bloco
            icone={<AlertOctagon size={15} />}
            cor="amber"
            titulo="Banir usuário"
            sub="Bloqueia login mas preserva todos os dados. Reversível com 1 clique."
            botao={
              <button
                type="button"
                onClick={() => setMostrarBanir(v => !v)}
                disabled={isPending}
                className="flex items-center gap-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                <AlertOctagon size={13} />
                {mostrarBanir ? 'Cancelar' : 'Banir...'}
              </button>
            }
          />
        )}
      </div>

      {mostrarBanir && !banido && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider block mb-1">Motivo (opcional)</span>
            <input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: anúncios falsos, fraude, descumprimento dos termos…"
              className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-gray-900"
            />
            <p className="text-[11px] text-amber-700 mt-1">Mostrado para o usuário na tela de conta suspensa.</p>
          </label>
          <button
            type="button"
            onClick={banir}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {acao === 'banir' ? <Loader2 size={13} className="animate-spin" /> : <AlertOctagon size={13} />}
            Confirmar banimento
          </button>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100">
        <Bloco
          icone={<Trash2 size={15} />}
          cor="red"
          titulo="Excluir definitivamente"
          sub="Apaga login, perfil, imóveis, contratos, parcelas. Não tem volta. Use 'Banir' se quiser apenas bloquear acesso."
          botao={
            <button
              type="button"
              onClick={excluir}
              disabled={isPending || ehAdmin}
              className="flex items-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl disabled:opacity-40"
              title={ehAdmin ? 'Não dá pra excluir admin pela UI' : ''}
            >
              {acao === 'excluir' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Excluir...
            </button>
          }
        />
      </div>

      {feedback && (
        <div className={`text-sm flex items-center gap-2 ${feedback.tipo === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {feedback.tipo === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          {feedback.msg}
        </div>
      )}
    </div>
  )
}

function Bloco({
  icone, cor, titulo, sub, botao,
}: {
  icone: React.ReactNode
  cor: 'violet' | 'amber' | 'red' | 'green'
  titulo: string
  sub: string
  botao: React.ReactNode
}) {
  const bg = { violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700' }[cor]
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icone}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{titulo}</p>
        <p className="text-xs text-gray-500 mb-3">{sub}</p>
        {botao}
      </div>
    </div>
  )
}
