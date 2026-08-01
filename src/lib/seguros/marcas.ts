/**
 * Identidade visual das seguradoras.
 *
 * O corretor bate o olho na lista e precisa saber de quem é cada parecer
 * antes de ler o nome — daí a cor por marca. Cor de STATUS é outra coisa
 * (verde aprovado, âmbar aguardando, vermelho recusado) e vive separada:
 * misturar as duas faria "Tokio" parecer aprovada só por ser verde.
 *
 * Usamos iniciais em vez de logotipo: não temos os arquivos de marca nem
 * autorização de uso. Quando vier o manual de marca da corretora, troca
 * aqui e nada mais muda.
 */

export interface MarcaSeguradora {
  nome: string
  curto: string          // 2–3 letras do selo
  cor: string            // cor da marca (borda e selo)
  corTexto: string       // contraste sobre `cor`
  corFundo: string       // fundo suave do selo
}

const PADRAO: MarcaSeguradora = {
  nome: 'Seguradora',
  curto: '••',
  cor: '#64748b',
  corTexto: '#ffffff',
  corFundo: '#f1f5f9',
}

const MARCAS: Record<string, MarcaSeguradora> = {
  porto: {
    nome: 'Porto Seguro',
    curto: 'PS',
    cor: '#0B4EA2',      // azul Porto
    corTexto: '#ffffff',
    corFundo: '#e8f0fb',
  },
  ptc: {
    nome: 'Pottencial',
    curto: 'Pt',
    cor: '#E4451F',      // laranja-vermelho Pottencial
    corTexto: '#ffffff',
    corFundo: '#fdeeea',
  },
  tok: {
    nome: 'Tokio Marine',
    curto: 'TM',
    cor: '#00843D',      // verde Tokio
    corTexto: '#ffffff',
    corFundo: '#e6f4ec',
  },
  too: {
    nome: 'Too Seguros',
    curto: 'too',
    cor: '#00A9A5',      // verde-água Too
    corTexto: '#ffffff',
    corFundo: '#e5f6f6',
  },
}

export function marcaDe(sigla: string | null | undefined): MarcaSeguradora {
  const s = (sigla ?? '').toLowerCase().trim()
  return MARCAS[s] ?? { ...PADRAO, curto: s.slice(0, 3).toUpperCase() || '••' }
}
