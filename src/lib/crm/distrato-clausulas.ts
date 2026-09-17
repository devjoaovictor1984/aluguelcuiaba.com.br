/**
 * Cláusulas do distrato da 2ª em diante, e o fechamento (v98).
 *
 * Mesma ideia do termo aditivo (aditivo-clausulas.ts): a 1ª é o objeto,
 * que muda a cada caso; as demais são quase sempre as mesmas e saem daqui
 * prontas, editáveis no modal. Uma fonte só pro modal (client) e pro PDF
 * (server) — o que a pessoa edita é o que sai impresso.
 *
 * O acerto de contas NÃO está aqui: ele vem dos campos próprios do
 * distrato (multa, débitos, caução) e o PDF monta a cláusula a partir
 * deles, porque é o trecho que as partes conferem número por número.
 */

import type { ClausulaAditivo } from './aditivo-clausulas'

/** O distrato reusa o formato {titulo, texto} do aditivo. */
export type ClausulaDistrato = ClausulaAditivo

export const FECHAMENTO_PADRAO_DISTRATO =
  'E, por estarem assim justas e acordadas, as partes assinam o presente Distrato digitalmente, ' +
  'em vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurídicos e legais efeitos.'

/** `cidadeUf` no formato do perfil: "Cuiabá-MT". */
export function clausulasPadraoDistrato(cidadeUf: string): ClausulaDistrato[] {
  const comarca = cidadeUf.replace('-', '/')
  return [
    {
      titulo: 'Da entrega do imóvel',
      texto:
        'O LOCATÁRIO entrega o imóvel livre e desocupado de pessoas e coisas, com as chaves e demais acessos, ' +
        'no estado em que o recebeu, ressalvado o desgaste natural decorrente do uso regular.\n\n' +
        'A vistoria de saída, quando realizada, integra este instrumento e é o documento que registra o estado do imóvel na devolução.\n\n' +
        'As despesas de água, energia, gás, condomínio e IPTU são de responsabilidade do LOCATÁRIO até a data da desocupação, ' +
        'ainda que as faturas venham a ser emitidas depois.',
    },
    {
      titulo: 'Da quitação',
      texto:
        'Cumpridas as obrigações ajustadas neste instrumento, as partes dão entre si plena, geral e irrevogável quitação ' +
        'quanto ao contrato de locação ora distratado, nada mais tendo a reclamar uma da outra, a qualquer título, ' +
        'seja a que tempo for.\n\n' +
        'Cessam, a partir da data da desocupação, todas as obrigações decorrentes do contrato, inclusive a garantia locatícia ' +
        'e a responsabilidade de fiador, se houver.',
    },
    {
      titulo: 'Da assinatura eletrônica',
      texto:
        'As partes reconhecem a validade da assinatura física ou eletrônica deste Distrato, inclusive por plataforma digital, ' +
        'com identificação dos signatários por e-mail, código de verificação, selfie e registro de data, hora, IP e localização, ' +
        'nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.\n\n' +
        'Quando assinado pela plataforma, o certificado de assinatura anexo, com o código de validação, integra este instrumento ' +
        'e comprova a autoria e a integridade do documento.',
    },
    {
      titulo: 'Do foro',
      texto:
        `As partes elegem o foro da Comarca de ${comarca} para dirimir quaisquer controvérsias oriundas deste Distrato, ` +
        'com renúncia a qualquer outro, por mais privilegiado que seja.',
    },
  ]
}

/** Motivos do distrato — os mesmos de encerrarContrato(), pra não haver duas taxonomias. */
export const MOTIVO_DISTRATO = {
  acordo: 'Acordo entre as partes',
  rescisao_inquilino: 'Pedido do locatário',
  rescisao_proprietario: 'Pedido do locador',
  inadimplencia: 'Inadimplência',
  fim_natural: 'Fim do prazo contratual',
  outro: 'Outro',
} as const

export type MotivoDistrato = keyof typeof MOTIVO_DISTRATO

/**
 * Texto inicial da cláusula 1ª por motivo. Só um ponto de partida: o
 * corretor reescreve por cima, como faz no aditivo.
 */
export const MODELO_OBJETO: Record<MotivoDistrato, string> = {
  acordo:
    'As partes, de comum acordo, resolvem dar por encerrado o contrato de locação a partir de ___, ' +
    'antes do término inicialmente pactuado, sem que caiba a qualquer delas indenização além do ajustado neste instrumento.',
  rescisao_inquilino:
    'O LOCATÁRIO manifesta o interesse em desocupar o imóvel antes do término do prazo contratual, ' +
    'o que é aceito pelo LOCADOR, ficando o contrato rescindido a partir de ___.',
  rescisao_proprietario:
    'O LOCADOR necessita retomar o imóvel antes do término do prazo contratual, no que é atendido pelo LOCATÁRIO, ' +
    'ficando o contrato rescindido a partir de ___.',
  inadimplencia:
    'Diante do inadimplemento das obrigações contratuais pelo LOCATÁRIO, as partes resolvem encerrar a locação a partir de ___, ' +
    'com o acerto de contas na forma deste instrumento, evitando a via judicial.',
  fim_natural:
    'Alcançado o termo final do prazo contratual, as partes formalizam o encerramento da locação a partir de ___, ' +
    'sem prorrogação, e acertam as contas na forma deste instrumento.',
  outro: '',
}
