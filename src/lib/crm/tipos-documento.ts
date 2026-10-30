/**
 * Nomes dos tipos de documento que a pessoa pode enviar pelo link de
 * atualização de cadastro.
 *
 * Vive fora da página porque a prévia do link (opengraph-image) mostra os
 * mesmos nomes, e duas listas iguais em arquivos diferentes viram uma lista
 * desatualizada.
 */
export const LABELS_DOC: Record<string, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  passaporte: 'Passaporte',
  comprovante_renda: 'Comprovante de renda',
  comprovante_residencia: 'Comprovante de residência',
  contracheque: 'Contracheque',
  extrato_bancario: 'Extrato bancário',
  imposto_renda: 'Imposto de renda',
  certidao_casamento: 'Certidão de casamento',
  certidao_nascimento: 'Certidão de nascimento',
  foto: 'Foto',
  outro: 'Outro',
  // Imóvel — ficam na pasta da proprietária, por isso aparecem nos anexos
  // do contrato de administração junto com o RG e o CPF dela.
  matricula_imovel: 'Matrícula do imóvel',
  escritura: 'Escritura / contrato de compra',
  iptu: 'Carnê do IPTU',
  conta_energia: 'Conta de energia',
  conta_agua: 'Conta de água',
  conta_gas: 'Conta de gás',
  boleto_condominio: 'Boleto do condomínio',
  procuracao: 'Procuração',
}

/** Tipos que são do imóvel, não da pessoa — o painel agrupa em separado. */
export const TIPOS_DOC_IMOVEL = [
  'matricula_imovel', 'escritura', 'iptu',
  'conta_energia', 'conta_agua', 'conta_gas',
  'boleto_condominio', 'procuracao',
] as const

export const TIPOS_DOC_VALIDOS = Object.keys(LABELS_DOC)

/**
 * "RG · CPF · Comprovante de renda  +2" — cabe numa linha do cartão de prévia.
 * Acima de `limite` tipos, o resto vira contagem.
 */
export function resumirTiposDoc(tipos: string[], limite = 3): string {
  const nomes = tipos.map(t => LABELS_DOC[t]).filter(Boolean)
  if (nomes.length === 0) return ''
  if (nomes.length <= limite) return nomes.join('  ·  ')
  return `${nomes.slice(0, limite).join('  ·  ')}  +${nomes.length - limite}`
}
