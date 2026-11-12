/**
 * Usuário autorizado — quem usa o imóvel sem ser locatário.
 *
 * Papel técnico: `ocupante_autorizado` (contratos_moradores). O nome que sai
 * nos documentos muda com a finalidade: em contrato comercial é "usuário
 * comercial autorizado"; em residencial, "ocupante autorizado". Nos dois
 * casos assina como INTERVENIENTE ANUENTE e não vira locatário, fiador nem
 * devedor solidário.
 *
 * Tudo aqui é função pura (sem banco) e leve, pra servir também às telas.
 * As cláusulas ficam em usuario-autorizado-clausulas.ts (puxam o motor).
 * Testes: tests/contratos/usuario-autorizado.test.ts.
 */
import type { ItemChecklist } from './checklist'

export type Finalidade = 'residencial' | 'comercial' | 'misto'
export type Consumo = 'energia' | 'agua' | 'gas' | 'internet'

export const CONSUMOS: Array<{ valor: Consumo; label: string; noContrato: string }> = [
  { valor: 'energia', label: 'Energia elétrica', noContrato: 'energia elétrica' },
  { valor: 'agua', label: 'Água', noContrato: 'água e esgoto' },
  { valor: 'gas', label: 'Gás', noContrato: 'gás' },
  { valor: 'internet', label: 'Internet', noContrato: 'internet/telecomunicações' },
]

export const PRAZO_TITULARIDADE_PADRAO = 10

// ── Rótulos ─────────────────────────────────────────────────────────

/** Nome do papel em texto corrido ("Usuário comercial autorizado"). */
export function rotuloUsuarioAutorizado(finalidade: Finalidade | null | undefined): string {
  return finalidade === 'comercial' ? 'Usuário comercial autorizado' : 'Ocupante autorizado'
}

/** Denominação no contrato, caixa alta, com a qualidade de anuente. */
export function denominacaoUsuarioAutorizado(finalidade: Finalidade | null | undefined, plural = false): string {
  if (finalidade === 'comercial') {
    return plural ? 'USUÁRIOS COMERCIAIS AUTORIZADOS' : 'USUÁRIO COMERCIAL AUTORIZADO'
  }
  return plural ? 'OCUPANTES AUTORIZADOS' : 'OCUPANTE AUTORIZADO'
}

// ── Prazo e status da troca de titularidade ─────────────────────────

/** Soma dias úteis (seg–sex) a uma data ISO. Feriados não entram. */
export function somarDiasUteis(isoData: string, dias: number): string {
  const d = new Date(`${isoData.slice(0, 10)}T12:00:00Z`)
  let restam = dias
  while (restam > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) restam--
  }
  return d.toISOString().slice(0, 10)
}

export type StatusTitularidade = 'sem_obrigacao' | 'confirmada' | 'aguardando_chaves' | 'no_prazo' | 'atrasada'

export function statusTitularidade(args: {
  consumos_titular?: string[] | null
  titularidade_confirmada_em?: string | null
  chaves_entregues_em?: string | null
  prazo_dias_uteis?: number | null
  hoje?: string
}): { status: StatusTitularidade; prazo_ate: string | null } {
  if (!(args.consumos_titular ?? []).length) return { status: 'sem_obrigacao', prazo_ate: null }
  if (args.titularidade_confirmada_em) return { status: 'confirmada', prazo_ate: null }
  if (!args.chaves_entregues_em) return { status: 'aguardando_chaves', prazo_ate: null }
  const ate = somarDiasUteis(args.chaves_entregues_em, args.prazo_dias_uteis ?? PRAZO_TITULARIDADE_PADRAO)
  const hoje = args.hoje ?? new Date().toISOString().slice(0, 10)
  return { status: hoje > ate ? 'atrasada' : 'no_prazo', prazo_ate: ate }
}

// ── Validações (entram no checklist pré-PDF) ────────────────────────

export interface DadosVerificacao {
  finalidade: Finalidade
  garantia_tipo?: string | null
  seguradora_ciente_usuario_em?: string | null
  usuarios: Array<{
    nome: string
    cpf_cnpj?: string | null
    mora_no_imovel?: boolean | null
    consumos_titular?: string[] | null
    atividade_no_imovel?: string | null
  }>
  /** Pessoas com outro papel no mesmo contrato — pra achar duplicidade. */
  outros_vinculos?: Array<{ nome: string; cpf_cnpj?: string | null; papel: string }>
  locatario_cpf_cnpj?: string | null
}

const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/**
 * Inconsistências do usuário autorizado. Só gera item quando há usuário
 * autorizado — contrato sem ele (todos os antigos) não ganha nada aqui.
 */
export function verificarUsuarioAutorizado(d: DadosVerificacao): ItemChecklist[] {
  const itens: ItemChecklist[] = []
  if (d.usuarios.length === 0) return itens
  const rot = rotuloUsuarioAutorizado(d.finalidade).toLowerCase()

  // Bloqueia: sem CPF não dá pra identificar quem assina nem titular de conta
  const semDoc = d.usuarios.filter(u => digitos(u.cpf_cnpj).length < 11)
  itens.push({
    id: 'usuario_doc',
    rotulo: `CPF/CNPJ do ${rot}`,
    severidade: semDoc.length ? 'block' : 'ok',
    mensagem: semDoc.length
      ? `${semDoc.map(u => u.nome).join(', ')} sem CPF/CNPJ válido — necessário para assinar e para a titularidade das contas.`
      : undefined,
  })

  // Bloqueia: a mesma pessoa não pode ser locatária e usuária autorizada
  const locDoc = digitos(d.locatario_cpf_cnpj)
  const ehLocatario = locDoc && d.usuarios.some(u => digitos(u.cpf_cnpj) === locDoc)
  if (ehLocatario) {
    itens.push({
      id: 'usuario_e_locatario', rotulo: `${rotuloUsuarioAutorizado(d.finalidade)} é o próprio locatário`,
      severidade: 'block',
      mensagem: 'O locatário principal não pode ser também usuário autorizado. Remova o vínculo.',
    })
  }

  // Alerta: mesma pessoa em dois papéis (ex.: também como morador/solidário)
  for (const u of d.usuarios) {
    const doc = digitos(u.cpf_cnpj)
    const outro = (d.outros_vinculos ?? []).find(v => doc && digitos(v.cpf_cnpj) === doc)
    if (outro) {
      itens.push({
        id: `usuario_duplicado_${doc}`, rotulo: `${u.nome} em dois papéis`,
        severidade: 'warn',
        mensagem: `Também está vinculado como "${outro.papel}". Confirme qual papel vale — os dois saem no contrato.`,
      })
    }
  }

  // Alerta: comercial sem atividade descrita
  if (d.finalidade === 'comercial') {
    const semAtv = d.usuarios.filter(u => !u.atividade_no_imovel?.trim())
    itens.push({
      id: 'usuario_atividade', rotulo: 'Atividade do usuário comercial',
      severidade: semAtv.length ? 'warn' : 'ok',
      mensagem: semAtv.length ? `Informe a atividade que ${semAtv.map(u => u.nome).join(', ')} exercerá no imóvel.` : undefined,
    })
  }

  // Alerta: seguro fiança aprovado no nome do locatário não cobre, sozinho,
  // o uso por terceiro — a seguradora precisa saber.
  if (d.garantia_tipo === 'seguro_fianca') {
    itens.push({
      id: 'usuario_seguradora', rotulo: 'Seguradora ciente do usuário autorizado',
      severidade: d.seguradora_ciente_usuario_em ? 'ok' : 'warn',
      mensagem: d.seguradora_ciente_usuario_em
        ? undefined
        : 'O imóvel será usado por pessoa diferente do locatário. Informe a seguradora e registre a ciência no contrato.',
    })
  }

  return itens
}

/** Vínculo cru de contratos_moradores, como as rotas leem do Supabase. */
export interface VinculoCru {
  papel: string
  mora_no_imovel?: boolean | null
  consumos_titular?: string[] | null
  atividade_no_imovel?: string | null
  pessoa: { nome: string; cpf_cnpj?: string | null } | Array<{ nome: string; cpf_cnpj?: string | null }> | null
}

/** Monta a entrada de `verificarUsuarioAutorizado` a partir dos vínculos crus. */
export function verificacaoDosVinculos(
  vinculos: VinculoCru[] | null | undefined,
  ctx: Omit<DadosVerificacao, 'usuarios' | 'outros_vinculos'>,
): DadosVerificacao {
  const usuarios: DadosVerificacao['usuarios'] = []
  const outros: NonNullable<DadosVerificacao['outros_vinculos']> = []
  for (const v of vinculos ?? []) {
    const p = Array.isArray(v.pessoa) ? v.pessoa[0] : v.pessoa
    if (!p?.nome) continue
    if (v.papel === 'ocupante_autorizado') {
      usuarios.push({
        nome: p.nome, cpf_cnpj: p.cpf_cnpj ?? null, mora_no_imovel: v.mora_no_imovel,
        consumos_titular: v.consumos_titular ?? [], atividade_no_imovel: v.atividade_no_imovel ?? null,
      })
    } else {
      outros.push({ nome: p.nome, cpf_cnpj: p.cpf_cnpj ?? null, papel: v.papel })
    }
  }
  return { ...ctx, usuarios, outros_vinculos: outros }
}
