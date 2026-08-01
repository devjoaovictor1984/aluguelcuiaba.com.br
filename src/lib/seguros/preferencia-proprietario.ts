/**
 * Preferência do proprietário sobre os seguros, definida no contrato de
 * administração.
 *
 * Sem 'server-only': as telas do cliente usam os rótulos.
 */

export const MODOS_SEGURO_INCENDIO = [
  'a_definir',
  'proprietario_possui',
  'administradora_contrata',
  'inquilino_contrata',
  'dispensado',
] as const

export type ModoSeguroIncendio = (typeof MODOS_SEGURO_INCENDIO)[number]

export const MODO_INCENDIO_LABEL: Record<ModoSeguroIncendio, string> = {
  a_definir:               'A definir com o proprietário',
  proprietario_possui:     'Proprietário já tem apólice',
  administradora_contrata: 'Administradora contrata',
  inquilino_contrata:      'Inquilino contrata por conta',
  dispensado:              'Proprietário dispensa',
}

export const MODO_INCENDIO_AJUDA: Record<ModoSeguroIncendio, string> = {
  a_definir:
    'Ainda não conversado. O contrato sai sem cláusula específica de seguro.',
  proprietario_possui:
    'Ele já contratou por fora. Informe seguradora, apólice e vencimento pra o sistema avisar antes de vencer.',
  administradora_contrata:
    'Você cota e contrata pela plataforma. Exige a autorização expressa abaixo.',
  inquilino_contrata:
    'O locatário resolve e apresenta a apólice. Você só confere e arquiva.',
  dispensado:
    'O proprietário abre mão. Registre por escrito — o seguro contra fogo é obrigação dele pela Lei do Inquilinato.',
}

export const GARANTIAS = ['seguro_fianca', 'fiador', 'caucao', 'sem_garantia'] as const
export type Garantia = (typeof GARANTIAS)[number]

export const GARANTIA_LABEL: Record<Garantia, string> = {
  seguro_fianca: 'Seguro fiança',
  fiador:        'Fiador',
  caucao:        'Caução',
  sem_garantia:  'Sem garantia',
}

/** O sistema pode oferecer contratação de incêndio para este contrato? */
export function podeContratarIncendio(adm: {
  seguro_incendio_modo?: string | null
  autoriza_cotacao_seguros?: boolean | null
}): boolean {
  return adm.seguro_incendio_modo === 'administradora_contrata'
    && !!adm.autoriza_cotacao_seguros
}

/** O proprietário aceita esta garantia? Lista vazia = sem restrição. */
export function garantiaPermitida(
  garantiasAceitas: string[] | null | undefined,
  garantia: string,
): boolean {
  if (!garantiasAceitas?.length) return true
  return garantiasAceitas.includes(garantia)
}
