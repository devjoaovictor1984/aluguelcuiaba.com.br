import type { EntidadePlaceholder, MotivoPendencia, PendenciaPlaceholder } from './montar'

/** Ids das partes do contrato, pra apontar onde cada dado se corrige. */
export interface IdsPartes {
  locador: string | null
  locatario: string | null
  conjuge: string | null
  fiador: string | null
  imovel: string | null
  /** Contrato de locação (contratos_locacao.id). */
  contrato: string | null
  /** Contrato de administração (contratos_administracao.id). */
  administracao: string | null
}

/**
 * Onde o usuário corrige a pendência. Tudo abre o cadastro de origem, não o
 * contrato: o dado certo fica no cadastro e o contrato lê de lá na próxima
 * geração, sem mexer nas cláusulas já editadas.
 *
 * Sem vínculo (ex.: contrato sem fiador escolhido) aponta pra edição do
 * contrato, que é onde a pessoa é escolhida. Placeholder desconhecido não
 * tem cadastro: corrige-se no texto da cláusula, então volta null.
 */
export function linkCorrecao(p: PendenciaPlaceholder, ids: IdsPartes): string | null {
  // Placeholder desconhecido e lacuna escrita à mão se corrigem no texto da
  // cláusula, no próprio editor — não há cadastro pra abrir.
  if (p.motivo === 'desconhecido' || p.motivo === 'manual') return null
  const editarContrato = ids.administracao
    ? `/painel/administracoes/${ids.administracao}/editar`
    : ids.contrato ? `/painel/contratos/${ids.contrato}/editar` : null

  const pessoa = (id: string | null) => (id ? `/painel/clientes/${id}` : editarContrato)
  const porEntidade: Record<EntidadePlaceholder, string | null> = {
    locador: pessoa(ids.locador),
    locatario: pessoa(ids.locatario),
    conjuge: pessoa(ids.conjuge),
    fiador: pessoa(ids.fiador),
    imovel: ids.imovel ? `/painel/anuncios/${ids.imovel}/editar` : editarContrato,
    admin: '/painel/perfil',
    contrato: editarContrato,
    administracao: editarContrato,
    clausula: null,
  }
  // Cônjuge "sem vínculo" é locatário sem cônjuge cadastrado: corrige na ficha dele.
  if (p.motivo === 'sem_vinculo' && p.entidade === 'conjuge') return pessoa(ids.locatario)
  if (p.motivo === 'sem_vinculo' && p.entidade !== 'admin') return editarContrato
  return porEntidade[p.entidade]
}

export const TEXTO_MOTIVO: Record<MotivoPendencia, string> = {
  vazio: 'em branco no cadastro',
  sem_vinculo: 'não há cadastro ligado ao contrato',
  desconhecido: 'chave inexistente — corrija o texto da cláusula',
  invalido: 'preenchido em formato inválido',
  manual: 'lacuna escrita no texto — edite a cláusula neste contrato',
}

export const ROTULO_ENTIDADE: Record<EntidadePlaceholder, string> = {
  locador: 'Locador / proprietário',
  locatario: 'Locatário',
  conjuge: 'Cônjuge do locatário',
  fiador: 'Fiador',
  admin: 'Administradora (seu perfil)',
  imovel: 'Imóvel',
  contrato: 'Dados do contrato',
  administracao: 'Contrato de administração',
  clausula: 'Texto da cláusula',
}
