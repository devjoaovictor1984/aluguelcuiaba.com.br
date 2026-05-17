// Converte valores monetários em reais por extenso (BR)
// Ex: 1234.56 → "Mil duzentos e trinta e quatro reais e cinquenta e seis centavos"

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ateNoventa(n: number): string {
  if (n < 10) return UNIDADES[n]
  if (n < 20) return DEZ_A_DEZENOVE[n - 10]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (u === 0) return DEZENAS[d]
  return `${DEZENAS[d]} e ${UNIDADES[u]}`
}

function ateNovecentosENoventaENove(n: number): string {
  if (n === 100) return 'cem'
  if (n < 100) return ateNoventa(n)
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (resto === 0) return CENTENAS[c]
  return `${CENTENAS[c]} e ${ateNoventa(resto)}`
}

function porGrupos(n: number): string[] {
  // Retorna grupos de 3 dígitos da direita pra esquerda: milhares, milhões, bilhões
  const grupos: string[] = []
  let resto = Math.floor(n)
  while (resto > 0) {
    grupos.push(String(resto % 1000))
    resto = Math.floor(resto / 1000)
  }
  return grupos
}

const SUFIXOS_SING = ['', 'mil', 'milhão', 'bilhão']
const SUFIXOS_PLUR = ['', 'mil', 'milhões', 'bilhões']

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const grupos = porGrupos(n)
  const partes: string[] = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const valor = parseInt(grupos[i])
    if (valor === 0) continue
    const sufixo = valor === 1 && i > 0 ? SUFIXOS_SING[i] : SUFIXOS_PLUR[i]
    const texto = i === 1 && valor === 1 ? 'mil' : ateNovecentosENoventaENove(valor)
    partes.push(sufixo ? `${texto} ${sufixo}`.trim() : texto)
  }

  // Conecta com "e" entre grupos quando o último grupo for < 100 ou múltiplo de 100
  let resultado = ''
  for (let i = 0; i < partes.length; i++) {
    if (i === 0) resultado = partes[i]
    else {
      const ultimo = parseInt(grupos[grupos.length - 1 - i])
      const proximoUltimo = i === partes.length - 1 ? parseInt(grupos[0]) : 0
      const conectar = (proximoUltimo > 0 && (proximoUltimo < 100 || proximoUltimo % 100 === 0)) || ultimo < 100
      resultado += conectar && i === partes.length - 1 ? ' e ' + partes[i] : ' ' + partes[i]
    }
  }
  return resultado.trim()
}

export function valorPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return ''
  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)

  const partes: string[] = []
  if (inteiro > 0) {
    const txtInt = inteiroPorExtenso(inteiro)
    partes.push(`${txtInt} ${inteiro === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) {
    const txtCent = ateNovecentosENoventaENove(centavos)
    partes.push(`${txtCent} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }
  if (partes.length === 0) return 'zero reais'

  const texto = partes.join(' e ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
