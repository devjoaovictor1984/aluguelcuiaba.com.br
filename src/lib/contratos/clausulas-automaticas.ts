/**
 * Cláusulas automáticas que dependem dos participantes do contrato. Uma fonte
 * só para a rota do PDF (que as insere) e para o editor (que as mostra e
 * deixa personalizar). Ver docs/contratos-participantes.md.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { clausulaUsuarioAutorizado, clausulaTitularidade, type ContextoClausula } from './usuario-autorizado-clausulas'
import type { OrigemAutomatica } from './documento-textos'
import type { Finalidade } from './usuario-autorizado'

export interface ClausulaAutomatica { origem: OrigemAutomatica; titulo: string; corpo: string }

type PessoaCrua = { nome: string; cpf_cnpj?: string | null; [k: string]: unknown }
export interface VinculoParaClausula {
  papel: string
  atividade_no_imovel?: string | null
  consumos_titular?: string[] | null
  pessoa: PessoaCrua | PessoaCrua[] | null
}

/** Monta as automáticas a partir dos vínculos já carregados. Sem usuário autorizado, lista vazia. */
export function clausulasAutomaticas(
  vinculos: VinculoParaClausula[] | null | undefined,
  ctx: ContextoClausula,
): ClausulaAutomatica[] {
  const usuarios = (vinculos ?? [])
    .filter(m => m.papel === 'ocupante_autorizado')
    .map(m => {
      const p = Array.isArray(m.pessoa) ? m.pessoa[0] : m.pessoa
      return p?.nome ? { pessoa: p, atividade_no_imovel: m.atividade_no_imovel, consumos_titular: m.consumos_titular ?? [] } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  if (usuarios.length === 0) return []
  const out: ClausulaAutomatica[] = []
  const a = clausulaUsuarioAutorizado(usuarios, ctx)
  if (a) out.push({ origem: 'usuario_autorizado', ...a })
  const t = clausulaTitularidade(usuarios, ctx)
  if (t) out.push({ origem: 'titularidade', ...t })
  return out
}

/** Carrega o necessário e monta as automáticas de um contrato (editor e actions). */
export async function carregarClausulasAutomaticas(sb: SupabaseClient, contratoId: string): Promise<ClausulaAutomatica[]> {
  const [{ data: contrato }, { data: vinculos }] = await Promise.all([
    sb.from('contratos_locacao')
      .select('finalidade, taxa_admin_valor, prazo_titularidade_dias_uteis, inquilino:pessoas!inquilino_id(nome), imovel:imoveis(uc_energia, matricula_agua, uc_gas)')
      .eq('id', contratoId)
      .maybeSingle(),
    sb.from('contratos_moradores')
      .select(`
        papel, atividade_no_imovel, consumos_titular,
        pessoa:pessoas(
          nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf, nacionalidade, estado_civil, profissao, genero,
          endereco_logradouro, endereco_numero, endereco_complemento,
          endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
        )
      `)
      .eq('contrato_id', contratoId),
  ])
  if (!contrato) return []
  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
  return clausulasAutomaticas(vinculos as VinculoParaClausula[] | null, {
    finalidade: (contrato.finalidade ?? 'residencial') as Finalidade,
    locatario_nome: (inq as { nome?: string } | null)?.nome ?? 'LOCATÁRIO',
    tem_administracao: (contrato.taxa_admin_valor ?? 0) > 0,
    prazo_titularidade_dias_uteis: contrato.prazo_titularidade_dias_uteis,
    imovel: (im as ContextoClausula['imovel']) ?? null,
  })
}
