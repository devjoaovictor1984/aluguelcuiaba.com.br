'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { ratearAcordo, resumirAcordo, type ParcelaParaAcordo } from '@/lib/crm/acordo'
import { cancelarParcelasFuturas } from '@/lib/crm/encerramento'
import type { BaseComissao } from '@/lib/crm/calculos'

/**
 * Acordo de quitação (v109). Ver src/lib/crm/acordo.ts para as regras do
 * rateio. Não encerra o contrato: isso é "Encerrar contrato", que baixa
 * as parcelas seguintes e libera o imóvel — parcela paga pelo acordo não
 * é tocada pelo encerramento (só pendentes depois da data).
 */

export interface AcordoInput {
  contrato_id: string
  parcela_ids: string[]
  valor_acordado: number
  data_pagamento: string   // YYYY-MM-DD
  observacao?: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

function revalidar(contratoId: string) {
  revalidatePath(`/painel/contratos/${contratoId}`)
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  revalidatePath('/painel/inicio')
  revalidatePath('/painel/cobrancas')
}

const ABERTAS = ['pendente', 'atrasado']

export async function registrarAcordo(input: AcordoInput): Promise<{ error?: string; ok?: boolean; desconto?: number }> {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const ids = [...new Set(input.parcela_ids ?? [])]
  if (!ids.length) return { error: 'Escolha ao menos uma parcela.' }
  if (ids.length > 120) return { error: 'Parcelas demais num acordo só.' }
  const valor = Math.round(Number(input.valor_acordado) * 100) / 100
  if (!isFinite(valor) || valor <= 0) return { error: 'Informe o valor recebido no acordo. Para perdoar tudo sem receber nada, use "Encerrar contrato".' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_pagamento ?? '')) return { error: 'Informe a data do recebimento.' }

  const { data: contrato } = await supabase.from('contratos_locacao')
    .select('id, codigo, taxa_admin_base')
    .eq('id', input.contrato_id).eq('user_id', acesso.userId).maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const { data: parcelas, error: eP } = await supabase.from('parcelas_aluguel')
    .select('id, numero, valor_aluguel, valor_seguro, valor_iptu, valor_condominio, valor_total, valor_comissao, valor_repasse_proprietario, status_pagamento, observacoes, acordo_id')
    .eq('contrato_id', contrato.id).in('id', ids)
  if (eP) return { error: /acordo_id/.test(eP.message) ? 'Falta rodar a migration v109 no Supabase.' : eP.message }
  if ((parcelas ?? []).length !== ids.length) return { error: 'Alguma parcela escolhida não é deste contrato.' }

  const fora = parcelas!.filter(p => !ABERTAS.includes(p.status_pagamento) || p.acordo_id)
  if (fora.length) {
    return { error: `A parcela ${fora.map(p => `#${p.numero}`).join(', ')} não está em aberto (já paga, cancelada ou em outro acordo).` }
  }

  const linhas = ratearAcordo(parcelas as unknown as ParcelaParaAcordo[], valor, (contrato.taxa_admin_base ?? 'aluguel') as BaseComissao)
  const tot = resumirAcordo(linhas)
  if (valor > tot.original) return { error: `O valor recebido (${brl(valor)}) é maior que o total das parcelas (${brl(tot.original)}). Use o pagamento normal com juros.` }

  const { data: acordo, error: eA } = await supabase.from('contratos_acordos').insert({
    contrato_id: contrato.id,
    user_id: acesso.userId,
    data_pagamento: input.data_pagamento,
    valor_original: tot.original,
    valor_acordado: valor,
    observacao: input.observacao?.trim() || null,
    parcelas: parcelas!.map(p => ({
      id: p.id, numero: p.numero, valor_total: p.valor_total, valor_comissao: p.valor_comissao,
      valor_repasse_proprietario: p.valor_repasse_proprietario, status_pagamento: p.status_pagamento,
      observacoes: p.observacoes,
    })),
  }).select('id').single()
  if (eA) return { error: /contratos_acordos/.test(eA.message) ? 'Falta rodar a migration v109 no Supabase.' : eA.message }

  const nums = linhas.map(l => `#${l.numero}`).join(', ')
  const nota = `Acordo de quitação em ${dataBR(input.data_pagamento)}: ${brl(valor)} pelas parcelas ${nums} (de ${brl(tot.original)}, desconto de ${brl(tot.desconto)}).`
    + (input.observacao?.trim() ? ` ${input.observacao.trim()}` : '')

  const feitas: string[] = []
  for (const l of linhas) {
    const orig = parcelas!.find(p => p.id === l.id)!
    const { error } = await supabase.from('parcelas_aluguel').update({
      status_pagamento: 'pago',
      data_pagamento: input.data_pagamento,
      valor_pago: l.valor_pago,
      juros_multa: 0,
      desconto: l.desconto,
      valor_comissao: l.valor_comissao,
      valor_repasse_proprietario: l.valor_repasse_proprietario,
      pago_por: 'locatario',
      sinistro_id: null,
      acordo_id: acordo.id,
      observacoes: orig.observacoes ? `${orig.observacoes}\n${nota}` : nota,
      updated_at: new Date().toISOString(),
    }).eq('id', l.id).in('status_pagamento', ABERTAS)
    if (error) {
      // Volta o que já foi gravado: acordo pela metade é pior que nenhum.
      await restaurar(supabase, acordo.id, parcelas!.filter(p => feitas.includes(p.id)))
      await supabase.from('contratos_acordos').delete().eq('id', acordo.id)
      return { error: `Não deu para gravar a parcela #${l.numero}: ${error.message}. Nada foi alterado.` }
    }
    feitas.push(l.id)
  }

  revalidar(contrato.id)
  return { ok: true, desconto: tot.desconto }
}

type Foto = { id: string; valor_comissao: number; valor_repasse_proprietario: number; status_pagamento: string; observacoes: string | null }

async function restaurar(supabase: Awaited<ReturnType<typeof createClient>>, acordoId: string, fotos: Foto[]) {
  for (const f of fotos) {
    await supabase.from('parcelas_aluguel').update({
      status_pagamento: ABERTAS.includes(f.status_pagamento) ? f.status_pagamento : 'pendente',
      data_pagamento: null,
      valor_pago: null,
      juros_multa: 0,
      desconto: 0,
      valor_comissao: f.valor_comissao,
      valor_repasse_proprietario: f.valor_repasse_proprietario,
      observacoes: f.observacoes,
      acordo_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', f.id).eq('acordo_id', acordoId)
  }
}

export async function desfazerAcordo(acordoId: string): Promise<{ error?: string; ok?: boolean }> {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: acordo } = await supabase.from('contratos_acordos')
    .select('id, contrato_id, parcelas').eq('id', acordoId).eq('user_id', acesso.userId).maybeSingle()
  if (!acordo) return { error: 'Acordo não encontrado.' }

  const fotos = (acordo.parcelas ?? []) as Foto[]
  const { data: atuais } = await supabase.from('parcelas_aluguel')
    .select('id, numero, status_repasse, nf_emitida_em').eq('acordo_id', acordo.id)
  const repassadas = (atuais ?? []).filter(p => p.status_repasse === 'pago')
  if (repassadas.length) {
    return { error: `O repasse da parcela ${repassadas.map(p => `#${p.numero}`).join(', ')} já foi marcado como feito. Desmarque o repasse antes de desfazer o acordo.` }
  }
  const comNf = (atuais ?? []).filter(p => p.nf_emitida_em)
  if (comNf.length) {
    return { error: `A parcela ${comNf.map(p => `#${p.numero}`).join(', ')} já tem nota fiscal emitida com o valor do acordo. Cancele a nota antes de desfazer.` }
  }

  await restaurar(supabase, acordo.id, fotos)
  const { error } = await supabase.from('contratos_acordos').delete().eq('id', acordo.id)
  if (error) return { error: error.message }

  // Contrato já encerrado: parcela que volta a ficar em aberto depois da
  // data de saída não é mais devida — mesma regra de encerrarContrato.
  const { data: contrato } = await supabase.from('contratos_locacao')
    .select('status, data_encerramento').eq('id', acordo.contrato_id).maybeSingle()
  if (contrato && ['encerrado', 'rescindido'].includes(contrato.status)) {
    await cancelarParcelasFuturas(supabase, acordo.contrato_id, contrato.data_encerramento,
      `Contrato ${contrato.status} em ${contrato.data_encerramento} (acordo desfeito)`)
  }

  revalidar(acordo.contrato_id)
  return { ok: true }
}
