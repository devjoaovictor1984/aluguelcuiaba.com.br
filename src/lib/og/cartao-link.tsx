import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Cartão de prévia dos links por token (assinatura, revisão, termo, vistoria,
 * seguro).
 *
 * Sem isso todos herdavam o OG do portal e chegavam no WhatsApp anunciando
 * "apartamento, casa, comercial, kitnet..." — confuso pra quem esperava um
 * documento e com cara de spam, logo nos links que mais precisam passar
 * confiança. Um layout só pros cinco: muda o texto, não a arte.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export interface CartaoLink {
  /** Tarja pequena em maiúsculas: que tipo de documento é. */
  rotulo: string
  /** A linha grande — nome de quem recebe, quando existe. */
  destaque: string
  /** Frase logo abaixo do destaque. */
  linha: string
  /** Contrato, imóvel, papel — o que ajuda a identificar. Opcional. */
  detalhe?: string
  /** Texto da pílula ("Toque para assinar"). */
  acao: string
  /** Quem emitiu: administradora/corretor. */
  emitente: string
}

async function carregarFonte(arquivo: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', arquivo))
    return Uint8Array.from(buf).buffer
  } catch {
    // Sem a fonte a imagem ainda sai, na fonte padrão do next/og. Não vale
    // perder a prévia inteira por causa disso.
    return null
  }
}

export async function cartaoLinkImage(dados: CartaoLink): Promise<ImageResponse> {
  const [bold, regular, logo] = await Promise.all([
    carregarFonte('Poppins-Bold.ttf'),
    carregarFonte('Poppins-Regular.ttf'),
    readFile(join(process.cwd(), 'public', 'logo.png'))
      .then(b => `data:image/png;base64,${b.toString('base64')}`)
      .catch(() => null),
  ])

  const fonts = [
    bold && { name: 'Poppins', data: bold, weight: 700 as const, style: 'normal' as const },
    regular && { name: 'Poppins', data: regular, weight: 400 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 400; style: 'normal' }[]

  // A caixa comporta ~24 caracteres em 62px. Diminui até onde ainda fica
  // legível no card pequeno do WhatsApp.
  const destaque = dados.destaque.trim().replace(/\s+/g, ' ')
  const tamanhoDestaque = destaque.length > 34 ? 42 : destaque.length > 24 ? 48 : destaque.length > 18 ? 56 : 62

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 48,
          background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
          fontFamily: fonts.length ? 'Poppins' : undefined,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#ffffff',
            borderRadius: 32,
            padding: '56px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} width={430} height={39} alt="" />
              : <div style={{ fontSize: 34, fontWeight: 700, color: '#6d28d9' }}>AluguelCuiabá</div>}

            <div
              style={{
                display: 'flex',
                marginTop: 40,
                fontSize: 21,
                letterSpacing: 3,
                fontWeight: 700,
                color: '#7c3aed',
              }}
            >
              {dados.rotulo}
            </div>

            <div style={{ display: 'flex', marginTop: 14, fontSize: tamanhoDestaque, fontWeight: 700, color: '#111827' }}>
              {destaque}
            </div>

            <div style={{ display: 'flex', marginTop: 6, fontSize: 34, color: '#4b5563' }}>
              {dados.linha}
            </div>

            {dados.detalhe && (
              <div style={{ display: 'flex', marginTop: 26, fontSize: 26, color: '#6b7280' }}>
                {dados.detalhe}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                background: '#6d28d9',
                color: '#ffffff',
                fontSize: 26,
                fontWeight: 700,
                padding: '16px 34px',
                borderRadius: 999,
              }}
            >
              {dados.acao}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af' }}>{dados.emitente}</div>
              <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af' }}>www.aluguelcuiaba.com.br</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  )
}

/** Corta nome comprido pro primeiro nome, que é o que a pessoa reconhece. */
export function nomeCurto(nome: string | null | undefined, limite = 30): string {
  const limpo = (nome ?? '').trim().replace(/\s+/g, ' ')
  if (!limpo) return ''
  return limpo.length > limite ? limpo.split(' ')[0] : limpo
}
