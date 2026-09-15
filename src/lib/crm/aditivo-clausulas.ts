/**
 * Cláusulas do termo aditivo da 2ª em diante, e o fechamento (v96).
 *
 * A 1ª é o objeto, que muda a cada aditivo. As demais são quase sempre as
 * mesmas — ratificação, assinatura eletrônica, foro —, então saem daqui
 * prontas e o corretor só mexe quando precisa. Uma fonte só pro modal
 * (client) e pro PDF (server): o que a pessoa edita é o que sai impresso.
 *
 * A linguagem da assinatura segue o modelo do contrato (seed-modelo.ts):
 * vale física ou eletrônica, com MP 2.200-2/2001 e Lei 14.063/2020.
 */

export interface ClausulaAditivo {
  titulo: string
  texto: string
}

export const FECHAMENTO_PADRAO_ADITIVO =
  'E, por estarem assim justas e acordadas, as partes assinam o presente Termo Aditivo digitalmente, ' +
  'em vias de igual teor, juntamente com 02 (duas) testemunhas.'

/** `cidadeUf` no formato do perfil: "Cuiabá-MT". */
export function clausulasPadraoAditivo(contrato: 'locacao' | 'administracao', cidadeUf: string): ClausulaAditivo[] {
  const comarca = cidadeUf.replace('-', '/')
  const nomeContrato = contrato === 'administracao' ? 'contrato de administração' : 'contrato de locação'
  return [
    {
      titulo: 'Da ratificação',
      texto:
        `Permanecem em pleno vigor, ratificadas e inalteradas, todas as demais cláusulas, condições e obrigações do ${nomeContrato} originário e de eventuais aditivos anteriores que não tenham sido expressamente modificadas por este instrumento.\n\n` +
        `Este Termo Aditivo passa a integrar o ${nomeContrato} para todos os fins de direito, como se nele estivesse transcrito.`,
    },
    {
      titulo: 'Da assinatura eletrônica',
      texto:
        'As partes reconhecem a validade da assinatura física ou eletrônica deste Termo Aditivo, inclusive por plataforma digital, com identificação dos signatários por e-mail, código de verificação, selfie e registro de data, hora, IP e localização, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.\n\n' +
        'Quando assinado pela plataforma, o certificado de assinatura anexo, com o código de validação, integra este instrumento e comprova a autoria e a integridade do documento.',
    },
    {
      titulo: 'Do foro',
      texto: `As partes elegem o foro da Comarca de ${comarca} para dirimir quaisquer controvérsias oriundas deste Termo Aditivo, com renúncia a qualquer outro, por mais privilegiado que seja.`,
    },
  ]
}

/** Tira espaço das pontas e descarta cláusula vazia (sem título nem texto). */
export function normalizarClausulas(lista: ClausulaAditivo[]): ClausulaAditivo[] {
  return lista
    .map(c => ({ titulo: c.titulo.trim(), texto: c.texto.trim() }))
    .filter(c => c.titulo || c.texto)
}

export function mesmasClausulas(a: ClausulaAditivo[], b: ClausulaAditivo[]): boolean {
  return JSON.stringify(normalizarClausulas(a)) === JSON.stringify(normalizarClausulas(b))
}

/**
 * Lê o JSONB com defesa: vem do banco ou de uma action, então qualquer
 * coisa fora do formato vira null — e o PDF cai no texto padrão em vez
 * de quebrar. Lista vazia também é null.
 */
export function lerClausulas(v: unknown): ClausulaAditivo[] | null {
  if (!Array.isArray(v)) return null
  const lista = normalizarClausulas(
    v
      .filter((c): c is { titulo?: unknown; texto?: unknown } => !!c && typeof c === 'object')
      .map(c => ({
        titulo: typeof c.titulo === 'string' ? c.titulo.slice(0, 200) : '',
        texto: typeof c.texto === 'string' ? c.texto.slice(0, 20000) : '',
      })),
  ).slice(0, 30)
  return lista.length > 0 ? lista : null
}
