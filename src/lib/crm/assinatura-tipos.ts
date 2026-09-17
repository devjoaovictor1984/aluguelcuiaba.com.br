/**
 * Documentos que passam pela assinatura eletrônica (v94).
 *
 * `contrato_assinaturas.contrato_id` aponta pra coisa diferente conforme o
 * tipo — é sempre a chave do PDF que as partes leem:
 *   - locacao               → id da GERAÇÃO (contrato_geracoes.id)
 *   - administracao         → id do contrato de administração
 *   - aditivo_locacao       → id em contratos_aditivos
 *   - aditivo_administracao → id em contratos_administracao_aditivos
 *   - distrato_locacao      → id em contratos_distratos
 *
 * Sem 'server-only' de propósito: o painel (client) usa os rótulos também.
 */
export type TipoAssinatura =
  | 'locacao' | 'administracao'
  | 'aditivo_locacao' | 'aditivo_administracao'
  | 'distrato_locacao'

export function ehAditivo(tipo: string): tipo is 'aditivo_locacao' | 'aditivo_administracao' {
  return tipo === 'aditivo_locacao' || tipo === 'aditivo_administracao'
}

export function ehDistrato(tipo: string): tipo is 'distrato_locacao' {
  return tipo === 'distrato_locacao'
}

/**
 * Documentos que só admitem UM processo de assinatura por vez: dois em
 * paralelo seriam duas trilhas pro mesmo papel, e a assinatura desenhada
 * no PDF viria de um ou de outro conforme a hora. O contrato escapa
 * porque a chave dele é a geração, que se refaz.
 */
export function processoUnico(tipo: string): boolean {
  return ehAditivo(tipo) || ehDistrato(tipo)
}

/** "contrato", "termo aditivo" ou "distrato" — pra compor frase ("assine o ___"). */
export function nomeDocumento(tipo: string): 'contrato' | 'termo aditivo' | 'distrato' {
  if (ehAditivo(tipo)) return 'termo aditivo'
  if (ehDistrato(tipo)) return 'distrato'
  return 'contrato'
}

const ROTULO: Record<TipoAssinatura, string> = {
  locacao: 'Contrato de Locação',
  administracao: 'Contrato de Administração',
  aditivo_locacao: 'Termo Aditivo ao Contrato de Locação',
  aditivo_administracao: 'Termo Aditivo ao Contrato de Administração',
  distrato_locacao: 'Distrato do Contrato de Locação',
}

/** Nome do documento por extenso, pra certificado e página de validação. */
export function rotuloDocumento(tipo: string): string {
  return ROTULO[tipo as TipoAssinatura] ?? 'Contrato'
}

/** Rota do PDF que o signatário lê, autorizada pelo token dele (?st=). */
export function rotaPdfDocumento(tipo: TipoAssinatura, id: string, token: string): string {
  switch (tipo) {
    case 'administracao': return `/api/contratos-admin/${id}/pdf?st=${token}`
    case 'aditivo_locacao': return `/api/contratos/aditivos/${id}/pdf?st=${token}`
    case 'aditivo_administracao': return `/api/contratos-admin/aditivos/${id}/pdf?st=${token}`
    case 'distrato_locacao': return `/api/contratos/distratos/${id}/pdf?st=${token}`
    default: return `/api/contratos/${id}/pdf?st=${token}`
  }
}
