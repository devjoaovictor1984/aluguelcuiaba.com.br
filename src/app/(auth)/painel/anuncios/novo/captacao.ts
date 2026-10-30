import type { Bairro, TipoImovel } from '@/types'
import { TIPOS_IMOVEL } from '@/lib/constants'
import { dadosImovelParaColunas, numeroBr } from '@/lib/crm/campos-imovel'
import { slugify } from '@/lib/utils'
import type { InicialCaptacao } from './form'

/** "1234.5" → "1234,50", como o formulário do anúncio espera. */
function moeda(n: number | null): string | undefined {
  return n === null ? undefined : n.toFixed(2).replace('.', ',')
}

function inteiro(s: string | undefined, max: number): number | undefined {
  const n = numeroBr(s)
  return n === null ? undefined : Math.min(max, Math.round(n))
}

/**
 * Respostas do link de captação → estado inicial do anúncio novo.
 * O bairro chega em texto livre; casa com a lista pelo nome normalizado,
 * e se não casar o corretor escolhe.
 */
export function inicialDaCaptacao(
  solicitacaoId: string,
  d: Record<string, string>,
  bairros: Bairro[],
): InicialCaptacao {
  const tipo = TIPOS_IMOVEL.some(t => t.value === d.imovel_tipo) ? d.imovel_tipo as TipoImovel : undefined
  const bairroSlug = d.imovel_endereco_bairro ? slugify(d.imovel_endereco_bairro) : ''
  const bairro = bairroSlug ? bairros.find(b => slugify(b.nome) === bairroSlug) : undefined
  const mob = d.imovel_mobiliado
  const iptuAnual = numeroBr(d.imovel_iptu_anual)
  const col = dadosImovelParaColunas(d)

  return {
    solicitacaoId,
    tipo,
    bairroId: bairro?.id,
    condominioNome: d.imovel_condominio_nome,
    logradouro: d.imovel_endereco_logradouro,
    numero: d.imovel_endereco_numero,
    complemento: d.imovel_endereco_complemento,
    quartos: inteiro(d.imovel_quartos, 5),
    suites: inteiro(d.imovel_suites, 3),
    banheiros: inteiro(d.imovel_banheiros, 4),
    vagas: inteiro(d.imovel_vagas, 3),
    areaM2: moeda(numeroBr(d.imovel_area_construida_m2))?.replace(/,00$/, ''),
    mobiliado: mob === 'sim' || mob === 'semi' || mob === 'nao' ? mob : undefined,
    preco: moeda(numeroBr(d.imovel_valor_aluguel)),
    taxaCondo: moeda(numeroBr(d.imovel_taxa_condominio)),
    iptu: moeda(iptuAnual === null ? null : iptuAnual / 12),
    dadosContrato: {
      endereco_completo: d.imovel_endereco_logradouro ?? '',
      endereco_numero: d.imovel_endereco_numero ?? '',
      endereco_complemento: d.imovel_endereco_complemento ?? '',
      endereco_cep: String(col.endereco_cep ?? ''),
      matricula_cartorio: d.imovel_matricula_cartorio ?? '',
      cartorio_registro: d.imovel_cartorio_registro ?? '',
      inscricao_municipal: d.imovel_inscricao_municipal ?? '',
      uc_energia: d.imovel_uc_energia ?? '',
      matricula_agua: d.imovel_matricula_agua ?? '',
      uc_gas: d.imovel_uc_gas ?? '',
      area_construida_m2: d.imovel_area_construida_m2 ?? '',
      area_terreno_m2: d.imovel_area_terreno_m2 ?? '',
    },
  }
}
