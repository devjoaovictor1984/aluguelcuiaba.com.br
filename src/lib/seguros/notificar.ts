import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { enviarPushParaUser } from '@/lib/push/sender'
import { statusAprovado, statusPreAprovado } from './tabelas'
import { marcaDe } from './marcas'
import type { Parecer } from './tipos'

/**
 * Avisa o corretor quando um parecer muda de estado.
 *
 * Sem isto o webhook atualiza o banco em silêncio e o corretor descobre
 * só quando abre a tela — o que na prática vira ficar recarregando a
 * página, que é justamente o que a integração deveria eliminar.
 *
 * Só notifica transição que importa: entrou em aprovado, recusado ou
 * pediu biometria. Cada webhook dispara uma revalidação completa, então
 * notificar toda escrita geraria repetição.
 */

type Admin = ReturnType<typeof createAdminClient>

export interface EstadoAnterior {
  seguradoraSigla: string
  codigoStatus: number | null
  statusBiometria: number | null
}

/**
 * Fotografa os pareceres antes da atualização, pra comparar depois.
 *
 * Devolve `null` quando a leitura falha — e é diferente de lista vazia.
 * Lista vazia significa "não havia parecer, tudo é novidade"; null
 * significa "não sei o que havia". Tratar os dois igual faria o corretor
 * receber push repetido a cada webhook.
 */
export async function lerEstadoAnterior(
  admin: Admin,
  analiseId: string,
): Promise<EstadoAnterior[] | null> {
  const { data, error } = await admin
    .from('seguro_analise_pareceres')
    .select('seguradora_sigla, codigo_status, status_biometria')
    .eq('analise_id', analiseId)

  if (error) return null

  return (data ?? []).map(p => ({
    seguradoraSigla: p.seguradora_sigla,
    codigoStatus: p.codigo_status,
    statusBiometria: p.status_biometria,
  }))
}

/**
 * Estado relevante — o que vale interromper o corretor.
 *
 * Pré-aprovado entra mesmo sem `statusBiometria` preenchido: o webhook de
 * biometria vem SEPARADO do de análise, então exigir `=== 0` deixaria o
 * corretor sem aviso justamente no estado em que a bola está com ele.
 */
function marco(p: { codigoStatus: number | null; statusBiometria: number | null }): string | null {
  if (statusAprovado(p.codigoStatus)) return 'aprovado'
  if (p.codigoStatus === 3) return 'recusado'
  if (statusPreAprovado(p.codigoStatus) && p.statusBiometria !== 1) return 'biometria'
  return null
}

/**
 * Compara antes e depois e manda um push por mudança relevante.
 *
 * Nunca lança: notificação que derruba o webhook faria a corretora
 * reenviar em loop.
 */
export async function notificarMudancas(
  admin: Admin,
  ctx: { userId: string; analiseId: string; nomeInquilino?: string | null },
  antes: EstadoAnterior[] | null,
  depois: Parecer[],
): Promise<void> {
  // Sem saber o estado anterior, não dá pra dizer o que mudou. Ficar
  // calado é melhor que notificar tudo de novo.
  if (antes === null) return

  try {
    const anterior = new Map(antes.map(a => [a.seguradoraSigla, a]))
    const url = `/painel/seguros/fianca/${ctx.analiseId}`
    const quem = ctx.nomeInquilino?.split(' ')[0] ?? 'o pretendente'

    for (const p of depois) {
      const novo = marco({ codigoStatus: p.codigoStatus, statusBiometria: p.statusBiometria })
      if (!novo) continue

      const velho = anterior.get(p.seguradoraSigla)
      // Já estava assim? Nada mudou pro corretor.
      if (velho && marco({ codigoStatus: velho.codigoStatus, statusBiometria: velho.statusBiometria }) === novo) {
        continue
      }

      const marca = marcaDe(p.seguradoraSigla)
      const nome = p.seguradoraNome ?? marca.nome

      const texto = novo === 'aprovado'
        ? { title: `${nome} aprovou`, body: `Fiança de ${quem} aprovada. Toque pra ver o valor e contratar.` }
        : novo === 'recusado'
          ? { title: `${nome} recusou`, body: `Fiança de ${quem} recusada. Dá pra reanalisar ou incluir solidário.` }
          : { title: `${nome}: falta biometria`, body: `${quem} precisa fazer o reconhecimento facial pra aprovação sair.` }

      await enviarPushParaUser(ctx.userId, {
        ...texto,
        url,
        // Uma notificação por seguradora: a tag substitui a anterior em
        // vez de empilhar quando o status muda de novo.
        tag: `seguro-${ctx.analiseId}-${p.seguradoraSigla}`,
        canal: 'seguro_parecer',
      })
    }
  } catch {
    /* silencioso de propósito */
  }
}
