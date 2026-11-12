/**
 * Cláusulas sintéticas do usuário autorizado (autorização de uso e troca de
 * titularidade das contas). Entram no PDF logo após "Das partes", no mesmo
 * padrão da cláusula do responsável pelo seguro: não ficam na biblioteca,
 * então não mexem em cláusula que o operador editou.
 */
import { numeroPorExtenso, qualificacaoParte } from './montar'
import {
  CONSUMOS, PRAZO_TITULARIDADE_PADRAO, denominacaoUsuarioAutorizado,
  type Consumo, type Finalidade,
} from './usuario-autorizado'

// ── Dados de entrada ────────────────────────────────────────────────

export interface PessoaUsuario {
  nome: string
  cpf_cnpj?: string | null
  [k: string]: unknown
}

export interface UsuarioAutorizado {
  pessoa: PessoaUsuario
  atividade_no_imovel?: string | null
  consumos_titular?: Consumo[] | string[] | null
}

export interface ContextoClausula {
  finalidade: Finalidade
  locatario_nome: string
  tem_administracao: boolean
  prazo_titularidade_dias_uteis?: number | null
  imovel?: { uc_energia?: string | null; matricula_agua?: string | null; uc_gas?: string | null } | null
}

export interface ClausulaSintetica { titulo: string; corpo: string }

const consumosDe = (u: UsuarioAutorizado): Consumo[] =>
  (u.consumos_titular ?? []).filter((c): c is Consumo => CONSUMOS.some(x => x.valor === c))

const listaHumana = (itens: string[]): string =>
  itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`

// ── Cláusula: autorização de uso ────────────────────────────────────

export function clausulaUsuarioAutorizado(
  usuarios: UsuarioAutorizado[],
  ctx: ContextoClausula,
): ClausulaSintetica | null {
  const lista = usuarios.filter(u => u.pessoa?.nome?.trim())
  if (lista.length === 0) return null
  const plural = lista.length > 1
  const D = denominacaoUsuarioAutorizado(ctx.finalidade, plural)
  const o = plural ? 'os' : 'o'
  const O = plural ? 'Os' : 'O'
  const destinatario = ctx.tem_administracao ? 'à ADMINISTRADORA ou ao LOCADOR' : 'ao LOCADOR'

  const uso = ctx.finalidade === 'comercial'
    ? 'no exercício de atividade comercial ou profissional lícita, compatível com a destinação ajustada neste contrato e com as normas do condomínio'
    : ctx.finalidade === 'misto'
      ? 'como residência e/ou no exercício de atividade profissional, conforme a destinação ajustada neste contrato'
      : 'como residência, conforme a destinação ajustada neste contrato'

  const identificacoes = lista.map(u => {
    const q = qualificacaoParte(u.pessoa as never) || u.pessoa.nome
    const atv = u.atividade_no_imovel?.trim()
    return atv ? `${q}, que exercerá no imóvel a atividade de ${atv}` : q
  })

  const corpo = [
    `${identificacoes.join('; ')}, ${plural ? 'participam' : 'participa'} do presente instrumento na qualidade de ${D} / INTERVENIENTE${plural ? 'S' : ''} ANUENTE${plural ? 'S' : ''}, ${plural ? 'indicados' : 'indicado'} pelo LOCATÁRIO, ${ctx.locatario_nome}, que permanece como único titular da relação locatícia, para utilizar o imóvel ${uso}.`,

    `Parágrafo primeiro. Nos termos do art. 13 da Lei nº 8.245/1991, o LOCADOR, ao firmar este instrumento, consente prévia e expressamente com a utilização do imóvel ${plural ? 'pelos' : 'pelo'} ${D}, nos limites aqui estabelecidos.`,

    `Parágrafo segundo. ${plural ? 'Ficam' : 'Fica'} ${o} ${D} ${plural ? 'autorizados' : 'autorizado'} a:\n` +
    `I. ter acesso ao imóvel e às áreas comuns do condomínio, receber as chaves e ser cadastrado na portaria, no controle de acesso e na administração do condomínio;\n` +
    `II. requerer em seu próprio nome, perante as concessionárias competentes, a titularidade das unidades consumidoras do imóvel, bem como a ligação, religação e o desligamento ao final da locação;\n` +
    `III. receber correspondências, comunicados do condomínio e avisos relativos ao uso do imóvel.`,

    `Parágrafo terceiro. A presente autorização não transfere a condição de LOCATÁRIO e não torna ${o} ${D} ${plural ? 'locatários, fiadores ou devedores solidários' : 'locatário, fiador ou devedor solidário'} do aluguel e dos encargos, que permanecem de responsabilidade do LOCATÁRIO, inclusive perante a seguradora do seguro fiança, quando houver. A autorização não define, por si só, a natureza jurídica da relação entre o LOCATÁRIO e ${o} ${D}, e qualquer cessão, sublocação ou empréstimo do imóvel a outras pessoas continua dependendo de consentimento prévio e escrito do LOCADOR.`,

    `Parágrafo quarto. ${O} ${D} ${plural ? 'respondem' : 'responde'} pelos danos que ${plural ? 'eles próprios causarem' : 'ele próprio causar'} ao imóvel, ao condomínio ou a terceiros e pelas obrigações que ${plural ? 'assumirem' : 'assumir'} expressamente neste instrumento, sem prejuízo da responsabilidade do LOCATÁRIO perante o LOCADOR, e ${plural ? 'obrigam-se' : 'obriga-se'} a observar as regras deste contrato, da convenção e do regimento interno do condomínio.`,

    `Parágrafo quinto. A autorização vigora enquanto durar a locação e se extingue com o seu término, ou antes, se revogada pelo LOCATÁRIO mediante comunicação escrita ${destinatario}, devendo ${o} ${D} desocupar o imóvel juntamente com o LOCATÁRIO.`,
  ].join('\n\n')

  const titulo = ctx.finalidade === 'comercial'
    ? (plural ? 'Dos usuários comerciais autorizados' : 'Do usuário comercial autorizado')
    : (plural ? 'Dos ocupantes autorizados' : 'Do ocupante autorizado')
  return { titulo, corpo }
}

// ── Cláusula: troca de titularidade das contas ──────────────────────

export function clausulaTitularidade(
  usuarios: UsuarioAutorizado[],
  ctx: ContextoClausula,
): ClausulaSintetica | null {
  const comConta = usuarios.filter(u => u.pessoa?.nome?.trim() && consumosDe(u).length > 0)
  if (comConta.length === 0) return null

  const prazo = ctx.prazo_titularidade_dias_uteis ?? PRAZO_TITULARIDADE_PADRAO
  const prazoTxt = `${prazo} (${numeroPorExtenso(prazo)}) dia${prazo === 1 ? '' : 's'} út${prazo === 1 ? 'il' : 'eis'}`
  const destinatario = ctx.tem_administracao ? 'à ADMINISTRADORA' : 'ao LOCADOR'
  const id = ctx.imovel ?? {}
  const identificador: Record<Consumo, string | null> = {
    energia: id.uc_energia ? `unidade consumidora nº ${id.uc_energia}` : null,
    agua: id.matricula_agua ? `matrícula nº ${id.matricula_agua}` : null,
    gas: id.uc_gas ? `código nº ${id.uc_gas}` : null,
    internet: null,
  }

  const obrigacoes = comConta.map(u => {
    const contas = consumosDe(u).map(c => {
      const nome = CONSUMOS.find(x => x.valor === c)!.noContrato
      return identificador[c] ? `${nome} (${identificador[c]})` : nome
    })
    return `${u.pessoa.nome} obriga-se a solicitar, perante a concessionária competente, a transferência para o seu nome da titularidade de ${listaHumana(contas)} do imóvel, no prazo de até ${prazoTxt} contados da efetiva entrega das chaves`
  })

  const corpo = [
    `${obrigacoes.join('; ')}.`,
    `Parágrafo primeiro. O responsável apresentará ${destinatario} o comprovante do pedido de transferência logo após realizá-lo e, depois, o comprovante da transferência concluída. A transferência só se considera realizada com o comprovante emitido pela concessionária, não bastando a assinatura deste instrumento.`,
    `Parágrafo segundo. O responsável pela titularidade responde pelas faturas de consumo do período de utilização, da entrega até a devolução das chaves, sem prejuízo da responsabilidade do LOCATÁRIO perante o LOCADOR por eventuais débitos não quitados.`,
    `Parágrafo terceiro. Havendo impedimento apresentado pela concessionária, o responsável o comunicará por escrito ${destinatario} em até 2 (dois) dias úteis, e as partes ajustarão a solução cabível, sem que a pendência dispense o pagamento das faturas.`,
    `Parágrafo quarto. Ao término da locação, o responsável solicitará o encerramento ou a transferência da titularidade conforme o procedimento da concessionária e apresentará as faturas quitadas até a data da entrega das chaves.`,
  ].join('\n\n')

  return { titulo: 'Da transferência de titularidade das contas de consumo', corpo }
}
