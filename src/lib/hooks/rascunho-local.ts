'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Rascunho de formulário longo guardado no navegador.
 *
 * Existe porque sair da página de um wizard — clicar em "Voltar", trocar o
 * tipo de contrato, fechar a aba sem querer — desmonta o componente e leva
 * junto tudo que foi digitado. O App Router não avisa nem pergunta: é uma
 * navegação client-side comum.
 *
 * Fica no navegador de propósito, não no banco: um contrato pela metade não
 * é um registro, é digitação em andamento. Salvar linha incompleta em
 * `contratos_locacao` criaria contrato fantasma na listagem, no financeiro e
 * na cota do plano.
 *
 * Todo acesso é em try/catch: em aba anônima, com site data bloqueado ou com
 * a cota estourada, o localStorage lança em vez de devolver vazio — e o
 * formulário tem que continuar funcionando do mesmo jeito.
 */

export interface Rascunho<T> {
  dados: T
  salvoEm: string
}

/** Sobe quando o formato do payload muda: rascunho velho é descartado, não migrado. */
const VERSAO = 'v1'

function chaveCompleta(chave: string): string {
  return `rascunho:${VERSAO}:${chave}`
}

/** Subscribe vazio: o rascunho é lido uma vez, não fica escutando o storage. */
const semInscricao = () => () => {}

export function useRascunhoLocal<T>(chave: string, { debounceMs = 500 } = {}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const k = chaveCompleta(chave)

  // O valor de abertura é lido uma vez e congelado: é a proposta de retomada,
  // não um espelho vivo do storage (que estas mesmas teclas estão reescrevendo
  // a cada meio segundo). useSyncExternalStore com getServerSnapshot = null é
  // o que deixa o servidor renderizar sem o aviso e o cliente com ele, sem
  // erro de hidratação.
  const lido = useRef<{ ok: boolean; valor: Rascunho<T> | null }>({ ok: false, valor: null })
  const lerUmaVez = useCallback((): Rascunho<T> | null => {
    if (!lido.current.ok) {
      let valor: Rascunho<T> | null = null
      try {
        const cru = window.localStorage.getItem(k)
        const parsed = cru ? (JSON.parse(cru) as Rascunho<T>) : null
        if (parsed && typeof parsed === 'object' && 'dados' in parsed) valor = parsed
      } catch {
        // Sem rascunho é o estado normal — não vale poluir o console.
      }
      lido.current = { ok: true, valor }
    }
    return lido.current.valor
  }, [k])

  const salvo = useSyncExternalStore(semInscricao, lerUmaVez, () => null)
  const noCliente = useSyncExternalStore(semInscricao, () => true, () => false)
  const [descartado, setDescartado] = useState(false)

  const salvar = useCallback((dados: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(k, JSON.stringify({ dados, salvoEm: new Date().toISOString() }))
      } catch {
        // Cota cheia ou storage bloqueado: seguir sem rascunho é melhor do
        // que derrubar o formulário que a pessoa está preenchendo.
      }
    }, debounceMs)
  }, [k, debounceMs])

  const descartar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    try {
      window.localStorage.removeItem(k)
    } catch {
      /* idem */
    }
    setDescartado(true)
  }, [k])

  // Um salvamento pendente no debounce morreria com o componente — que é
  // exatamente a hora em que ele mais importa.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return {
    rascunho: descartado ? null : salvo,
    carregado: noCliente,
    salvar,
    descartar,
  }
}

/** "agora há pouco", "há 5 minutos", "há 2 horas", "ontem" — pro aviso de retomada. */
export function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 2) return 'agora há pouco'
  if (min < 60) return `há ${min} minutos`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
