'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sessaoAtual } from '@/lib/homologacao/sessao'

/**
 * Registra um apontamento da sessão de homologação.
 *
 * O que faz este recurso valer alguma coisa não é o texto — é o que o
 * SERVIDOR anexa a ele. "Aqui está errado", lido uma semana depois, não
 * diz o que consertar. Com a rota, o registro, a seguradora e as últimas
 * chamadas de integração junto, dá para abrir o payload e ver o problema
 * sem precisar reproduzir.
 *
 * Por isso `contexto` e `eventos` não vêm do cliente: quem anota não
 * precisa saber o que é um endpoint.
 */

/** Extrai o UUID de rotas tipo /painel/seguros/fianca/<id>. */
function idDaRota(rota: string): string | null {
  const m = rota.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : null
}

function produtoDaRota(rota: string): 'fianca' | 'incendio' | null {
  if (rota.includes('/seguros/fianca')) return 'fianca'
  if (rota.includes('/seguros/incendio')) return 'incendio'
  return null
}

export async function registrarApontamento(input: {
  tipo: 'erro' | 'duvida' | 'sugestao' | 'ok'
  titulo: string
  detalhe?: string
  rota: string
}): Promise<{ ok?: true; error?: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { error: 'Sua sessão de testes terminou. Peça um link novo.' }

  const titulo = input.titulo.trim()
  if (!titulo) return { error: 'Escreva do que se trata.' }

  const admin = createAdminClient()
  const registroId = idDaRota(input.rota)
  const produto = produtoDaRota(input.rota)

  const contexto: Record<string, unknown> = {
    rota: input.rota,
    produto,
    registroId,
    em: new Date().toISOString(),
  }

  // Nome amigável do registro, para o painel não mostrar só um UUID.
  let eventos: unknown = null
  if (registroId && produto === 'fianca') {
    const { data: analise } = await admin
      .from('seguro_analises')
      .select('maximiza_id, status_resumo, tipo_analise, finalidade, payload')
      .eq('id', registroId)
      .maybeSingle()

    if (analise) {
      contexto.maximizaId = analise.maximiza_id
      contexto.status = analise.status_resumo
      contexto.tipoAnalise = analise.tipo_analise
      contexto.finalidade = analise.finalidade
    }

    const { data: evs } = await admin
      .from('seguro_eventos')
      .select('created_at, endpoint, direcao, http_status, duracao_ms, erro, request, response')
      .eq('analise_id', registroId)
      .order('created_at', { ascending: false })
      .limit(6)
    eventos = evs ?? null
  }

  /**
   * Sem id na URL, cai nas últimas chamadas da própria sessão.
   *
   * A tela de NOVA cotação não tem id — o registro ainda não existe. E é
   * exatamente onde uma cotação recusada acontece: a pessoa preenche,
   * toma erro da seguradora e anota ali mesmo. Sem esta queda, justamente
   * a anotação mais útil chegaria sem nenhuma chamada anexada.
   *
   * Filtra por usuário para não misturar com o que outra pessoa estava
   * fazendo no mesmo minuto.
   */
  if (!registroId) {
    const { data: evs } = await admin
      .from('seguro_eventos')
      .select('created_at, endpoint, direcao, http_status, duracao_ms, erro, request, response')
      .eq('user_id', sessao.usuarioId)
      .order('created_at', { ascending: false })
      .limit(6)
    eventos = evs ?? null
    contexto.origemDosEventos = 'ultimas-da-sessao'
  }

  if (registroId && produto === 'incendio') {
    const { data: apolice } = await admin
      .from('seguro_incendio_apolices')
      .select('seguradora, status, codigo_seguro, premio_total')
      .eq('id', registroId)
      .maybeSingle()

    if (apolice) {
      contexto.seguradora = apolice.seguradora
      contexto.status = apolice.status
      contexto.codigoSeguro = apolice.codigo_seguro
      contexto.premioTotal = apolice.premio_total
    }

    // O incêndio não amarra eventos a um id de apólice; as chamadas do
    // produto são identificadas pelo endpoint.
    const { data: evs } = await admin
      .from('seguro_eventos')
      .select('created_at, endpoint, direcao, http_status, duracao_ms, erro, request, response')
      .ilike('endpoint', '%incendio%')
      .order('created_at', { ascending: false })
      .limit(6)
    eventos = evs ?? null
  }

  const { error } = await admin.from('homologacao_apontamentos').insert({
    sessao_id: sessao.id,
    tipo: input.tipo,
    titulo,
    detalhe: input.detalhe?.trim() || null,
    contexto,
    eventos,
  })
  if (error) return { error: 'Não foi possível salvar sua anotação. Tente de novo.' }

  return { ok: true }
}
