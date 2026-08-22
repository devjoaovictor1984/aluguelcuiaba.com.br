import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createAdminClient } from '@/lib/supabase/admin'

export const alt = 'Contrato para assinatura eletrônica'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Prévia do link de assinatura no WhatsApp (e afins).
 *
 * Sem isso o link herdava o OG do portal — a pessoa recebia "Apartamento,
 * casa, comercial, kitnet..." num convite pra assinar contrato, o que além
 * de confuso passa cara de spam. Aqui a prévia diz o nome de quem tem que
 * assinar e qual documento é.
 *
 * O nome sai na imagem de propósito: quem recebe o link já é a pessoa em
 * questão, e ver o próprio nome é justamente o que dá confiança de que o
 * link é legítimo.
 */
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

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let nome = ''
  let papel = ''
  let titulo = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: sig } = await admin
      .from('contrato_assinatura_signatarios')
      .select('nome, papel, assinatura:contrato_assinaturas!inner(titulo, tipo_contrato, user_id)')
      .eq('token', token)
      .maybeSingle()

    if (sig) {
      const proc = (Array.isArray(sig.assinatura) ? sig.assinatura[0] : sig.assinatura) as
        { titulo: string | null; tipo_contrato: string; user_id: string } | undefined
      nome = sig.nome ?? ''
      papel = sig.papel ?? ''
      titulo = proc?.titulo ?? ''
      if (proc?.user_id) {
        const { data: perfil } = await admin
          .from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()
        emitente = perfil?.razao_social || perfil?.nome || emitente
      }
    }
  } catch {
    // Token inválido ou banco fora: cai na versão genérica, sem vazar nada.
  }

  const [bold, regular, logo] = await Promise.all([
    carregarFonte('Poppins-Bold.ttf'),
    carregarFonte('Poppins-Regular.ttf'),
    readFile(join(process.cwd(), 'public', 'logo.png')).then(b => `data:image/png;base64,${b.toString('base64')}`).catch(() => null),
  ])

  // Nome comprido estoura a linha (a caixa dá ~24 caracteres em 62px). Diminui
  // a fonte até onde ainda fica legível no card do WhatsApp e, passando disso,
  // usa só o primeiro nome — que é o que a pessoa precisa reconhecer.
  const limpo = nome.trim().replace(/\s+/g, ' ')
  const primeiroNome = limpo.split(' ')[0] ?? ''
  const nomeExibido = limpo.length > 30 ? primeiroNome : limpo
  const tamanhoNome = nomeExibido.length > 24 ? 48 : nomeExibido.length > 18 ? 56 : 62

  const fonts = [
    bold && { name: 'Poppins', data: bold, weight: 700 as const, style: 'normal' as const },
    regular && { name: 'Poppins', data: regular, weight: 400 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 400; style: 'normal' }[]

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
              ASSINATURA ELETRÔNICA DE CONTRATO
            </div>

            <div style={{ display: 'flex', marginTop: 14, fontSize: tamanhoNome, fontWeight: 700, color: '#111827' }}>
              {nomeExibido ? `${nomeExibido},` : 'Contrato para assinar'}
            </div>

            <div style={{ display: 'flex', marginTop: 6, fontSize: 34, color: '#4b5563' }}>
              {nomeExibido ? 'seu contrato está pronto para assinatura.' : 'toque para conferir e assinar.'}
            </div>

            {(titulo || papel) && (
              <div style={{ display: 'flex', marginTop: 26, fontSize: 26, color: '#6b7280' }}>
                {[titulo, papel].filter(Boolean).join('  ·  ')}
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
              Toque para assinar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af' }}>{emitente}</div>
              <div style={{ display: 'flex', fontSize: 22, color: '#9ca3af' }}>www.aluguelcuiaba.com.br</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
