/**
 * Endereço do imóvel para documentos.
 *
 * O cadastro guarda DOIS endereços com finalidades diferentes:
 *
 *  · `endereco_resumido` — o do anúncio. É aproximado de propósito (rua
 *    de referência, sem número), pra não expor o imóvel na vitrine.
 *  · `endereco_completo` + número + complemento — o real, preenchido na
 *    aba de dados do contrato (migration v28).
 *
 * Documento jurídico usa o real; o do anúncio é só último recurso. Isso
 * vivia duplicado em cada rota de PDF, e as de termo de chaves, vistoria
 * e recibo tinham ficado só com o resumido — saía o endereço do anúncio
 * num termo assinado.
 */

export interface ImovelParaEndereco {
  endereco_completo?: string | null
  endereco_resumido?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  bairro_nome?: string | null
}

/** Abreviações com que o mesmo trecho aparece escrito de jeitos diferentes. */
const SINONIMOS: Record<string, string> = {
  apto: 'ap', apt: 'ap', apartamento: 'ap',
  bloco: 'bl', bco: 'bl',
  quadra: 'qd', lote: 'lt',
  numero: 'n', num: 'n', no: 'n',
  edificio: 'ed', edif: 'ed',
}

/**
 * Forma canônica pra comparar pedaços de endereço: sem acento, sem
 * pontuação, com abreviação normalizada. "APT.423" e "apto 423" viram
 * ambos "ap423".
 *
 * O NFD separa o acento em caractere próprio, e o filtro seguinte já
 * descarta tudo que não é [a-z0-9] — então não precisa de passo extra
 * pra tirar diacrítico.
 */
function canonico(texto: string): string {
  return texto
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(t => SINONIMOS[t] ?? t)
    .join('')
}

/**
 * Monta o endereço para contrato, termo, vistoria e recibo.
 *
 * Só acrescenta um pedaço se ele ainda não estiver no que já foi
 * montado — é comum o complemento vir digitado dentro do
 * `endereco_completo` E no campo próprio, e "RUA W, APT.423, BLOCO 04,
 * apto 423" fica ruim num documento assinado.
 *
 * Retorna null quando não há endereço nenhum, pra quem chama decidir o
 * que fazer (os PDFs omitem o trecho).
 */
export function montarEnderecoImovel(im: ImovelParaEndereco | null | undefined): string | null {
  if (!im) return null

  const base = im.endereco_completo?.trim()
    ? [im.endereco_completo, im.endereco_numero ? `nº ${im.endereco_numero}` : null, im.endereco_complemento]
    : [im.endereco_resumido]

  const partes: string[] = []
  let acumulado = ''

  for (const parte of [...base, im.endereco_bairro ?? im.bairro_nome]) {
    const texto = parte?.trim()
    if (!texto) continue
    const chave = canonico(texto)
    if (chave && acumulado.includes(chave)) continue
    partes.push(texto)
    acumulado += chave
  }

  return partes.length ? partes.join(', ') : null
}
