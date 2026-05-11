import { DIAS_EXPIRACAO } from '@/lib/constants'

interface Props {
  imovel: {
    id: string
    titulo: string
    dias: number
  }
}

const cor = {
  roxo: '#7c3aed',
  vermelho: '#dc2626',
  cinzaTexto: '#374151',
  cinzaClaro: '#6b7280',
  cinzaMuito: '#9ca3af',
  fundo: '#f3f4f6',
}

export function EmailAvisoVencimento({ imovel }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'AlugaCuiabá'
  const painelUrl = `${appUrl}/painel`
  const urgente = imovel.dias <= 3

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: '24px', background: cor.fundo, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

          {/* Cabeçalho */}
          <div style={{ background: urgente ? cor.vermelho : cor.roxo, padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: '28px' }}>{urgente ? '⚠️' : '📅'}</p>
            <h1 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              {urgente ? 'Seu anúncio vence em breve!' : 'Lembrete de renovação'}
            </h1>
          </div>

          {/* Corpo */}
          <div style={{ padding: '32px 24px' }}>
            <p style={{ color: cor.cinzaTexto, fontSize: '16px', lineHeight: '1.6', marginTop: 0 }}>
              Seu anúncio <strong>"{imovel.titulo}"</strong> vence em{' '}
              <strong style={{ color: urgente ? cor.vermelho : cor.roxo }}>
                {imovel.dias} dia{imovel.dias !== 1 ? 's' : ''}
              </strong>.
            </p>

            <p style={{ color: cor.cinzaClaro, fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
              Renove agora para manter seu imóvel visível para inquilinos.
              A renovação estende a validade por mais <strong>{DIAS_EXPIRACAO} dias</strong> gratuitamente.
            </p>

            <div style={{ textAlign: 'center', margin: '32px 0' }}>
              <a
                href={painelUrl}
                style={{
                  display: 'inline-block',
                  background: cor.roxo,
                  color: '#fff',
                  padding: '14px 36px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '15px',
                }}
              >
                Renovar meu anúncio
              </a>
            </div>

            <p style={{ color: cor.cinzaMuito, fontSize: '12px', textAlign: 'center', margin: 0 }}>
              Acesse seu painel em{' '}
              <a href={painelUrl} style={{ color: cor.roxo, textDecoration: 'none' }}>
                {painelUrl}
              </a>
            </p>
          </div>

          {/* Rodapé */}
          <div style={{ background: cor.fundo, padding: '16px 24px', textAlign: 'center' }}>
            <p style={{ color: cor.cinzaMuito, fontSize: '11px', margin: 0, lineHeight: '1.5' }}>
              Você recebe este e-mail porque tem um anúncio ativo no {appName}.
              <br />Este é um e-mail automático — não responda.
            </p>
          </div>

        </div>
      </body>
    </html>
  )
}
