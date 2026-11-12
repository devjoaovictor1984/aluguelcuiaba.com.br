/**
 * Quem, entre os vinculados ao contrato, assina os documentos.
 *
 * A regra vivia copiada em cada lugar que precisava dela — a rota do PDF
 * do contrato, a do aditivo, a tela de geração e a do contrato — e foi
 * assim que os moradores acabaram aparecendo no contrato mas não no
 * aditivo: a cópia de lá nunca existiu. Aqui é uma só.
 *
 * Duas exclusões, e cada uma tem um porquê:
 *  · morador que não mora no imóvel não é parte de nada;
 *  · `assina_contrato = false` é a decisão explícita de quem cadastrou.
 *
 * Ocupante autorizado ASSINA sempre (antes não assinava): é quem de fato usa
 * o imóvel quando o locatário é outra pessoa — ex.: seguro fiança no nome do
 * sogro, genro ocupa a sala. Precisa constar na capa e assinar pra ter
 * autorização de acesso e de trocar a titularidade da luz. O `assina_contrato
 * = false` antigo dele era só o default da regra velha, por isso é ignorado.
 */

export const ROTULO_PAPEL_MORADOR: Record<string, string> = {
  inquilino_solidario: 'Co-locatário solidário',
  morador: 'Morador',
  socio_signatario: 'Sócio signatário',
  responsavel_seguro: 'Responsável pelo seguro fiança',
  conjuge_responsavel_seguro: 'Cônjuge do responsável pelo seguro',
  ocupante_autorizado: 'Ocupante autorizado',
  caucionante: 'Caucionante',
  interveniente_anuente: 'Interveniente anuente',
}

export interface VinculoMorador<P> {
  papel: string
  mora_no_imovel: boolean
  assina_contrato?: boolean | null
  /** O join do Supabase devolve objeto ou array conforme a relação. */
  pessoa: P | P[] | null
}

/**
 * Filtra os vínculos que assinam e devolve cada um com a pessoa já
 * desembrulhada e o papel em texto — pronto pro bloco de assinatura ou
 * pra lista de signatários.
 */
export function moradoresQueAssinam<P extends { nome: string }>(
  vinculos: Array<VinculoMorador<P>> | null | undefined,
): Array<{ pessoa: P; papel: string; rotulo: string }> {
  return (vinculos ?? [])
    .map(v => {
      const pessoa = Array.isArray(v.pessoa) ? v.pessoa[0] : v.pessoa
      if (!pessoa?.nome) return null
      if (v.papel !== 'ocupante_autorizado') {
        if (v.papel === 'morador' && !v.mora_no_imovel) return null
        if (!(v.assina_contrato ?? true)) return null
      }
      return {
        pessoa,
        papel: v.papel,
        rotulo: ROTULO_PAPEL_MORADOR[v.papel] ?? v.papel,
      }
    })
    .filter((x): x is { pessoa: P; papel: string; rotulo: string } => !!x)
}
