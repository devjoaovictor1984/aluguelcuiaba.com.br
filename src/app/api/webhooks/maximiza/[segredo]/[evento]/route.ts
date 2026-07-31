import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarEvento, consultarAnalise } from '@/lib/seguros'
import { gravarPareceres, gravarParecerUnico, resumirStatus } from '@/lib/seguros/pareceres'
import { salvarArquivo } from '@/lib/seguros/arquivos'
import { lerParecer } from '@/lib/seguros/maximiza/mapper'

/**
 * Webhooks da Maximiza: análise, biometria e arquivos.
 *
 * ⚠️ A API NÃO assina os webhooks — o único header documentado é
 * Content-Type. Sem defesa, qualquer um que descubra a URL manda um POST
 * dizendo que a análise X foi aprovada, e o corretor fecha contrato em
 * cima de aprovação falsa. Três camadas:
 *
 *   1. segredo no path (MAXIMIZA_WEBHOOK_SEGREDO) — barra varredura;
 *   2. a análise precisa existir no nosso banco;
 *   3. NÃO CONFIAMOS NO CORPO. O payload é só aviso de que algo mudou;
 *      relemos o estado com nosso token via GET e é isso que gravamos.
 *
 * A camada 3 é a que de fato protege — as outras são profundidade.
 *
 * Responder sempre {"success":"1"} — string, não número, como a doc pede.
 */

const OK = NextResponse.json({ success: '1' })
const FALHA = NextResponse.json({ success: '0' }, { status: 200 })

type Evento = 'analise' | 'biometria' | 'arquivos'
const EVENTOS: Evento[] = ['analise', 'biometria', 'arquivos']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segredo: string; evento: string }> },
) {
  const { segredo, evento } = await params

  const esperado = process.env.MAXIMIZA_WEBHOOK_SEGREDO
  if (!esperado || segredo !== esperado) {
    // 404 em vez de 401: não confirma que a rota existe.
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!EVENTOS.includes(evento as Evento)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return FALHA
  }

  const idExterno = Number(corpo.id ?? 0)

  await registrarEvento(admin, {
    direcao: 'entrada',
    endpoint: `/webhook/${evento}`,
    request: corpo,
  })

  if (!idExterno) return FALHA

  // A análise tem que ser nossa. Ambiente entra na busca porque o mesmo
  // id pode existir em homologação e produção.
  const { data: analise } = await admin
    .from('seguro_analises')
    .select('id, user_id, ambiente')
    .eq('maximiza_id', idExterno)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!analise) return FALHA

  try {
    if (evento === 'biometria') {
      // Único caso em que usamos o corpo: o link de biometria não aparece
      // no GET da análise, só chega por aqui. Ainda assim, só gravamos
      // campos de biometria — status de aprovação vem sempre do GET.
      const sigla = String(corpo.sigla ?? corpo.seguradora ?? '').toLowerCase()
      if (sigla) {
        await gravarParecerUnico(admin, analise.id, {
          seguradoraSigla: sigla,
          statusBiometria: corpo.statusBiometria != null ? Number(corpo.statusBiometria) : undefined,
          linkBiometria: corpo.linkBiometria ? String(corpo.linkBiometria) : undefined,
        })
      }
    }

    if (evento === 'arquivos') {
      const base64 = String(corpo.base64 ?? '')
      const codigoTipo = Number(corpo.codigoDescArquivo ?? 0)
      if (base64 && codigoTipo) {
        await salvarArquivo(admin, {
          seguradoraSigla: String(corpo.sigla ?? corpo.seguradora ?? '').toLowerCase() || null,
          codigoTipo,
          descricao: corpo.descricaoArquivo ? String(corpo.descricaoArquivo) : null,
          base64,
        }, { userId: analise.user_id, analiseId: analise.id })
      }
    }

    // Revalidação: a verdade vem da API, autenticada, não do corpo do POST.
    const { resultado, arquivos } = await consultarAnalise(admin, idExterno, {
      userId: analise.user_id,
      analiseId: analise.id,
    })

    if (resultado.pareceres.length) {
      await gravarPareceres(admin, analise.id, resultado.pareceres)
      await admin.from('seguro_analises')
        .update({ status_resumo: resumirStatus(resultado.pareceres), erro: null })
        .eq('id', analise.id)
    } else if (evento === 'analise') {
      // Sem retorno no GET, aproveita o aviso — melhor que perder o sinal.
      const p = lerParecer((corpo.analise ?? {}) as Record<string, never>)
      if (p.seguradoraSigla) await gravarParecerUnico(admin, analise.id, p)
    }

    for (const arq of arquivos) {
      await salvarArquivo(admin, arq, { userId: analise.user_id, analiseId: analise.id })
    }

    return OK
  } catch (e) {
    await registrarEvento(admin, {
      userId: analise.user_id,
      analiseId: analise.id,
      direcao: 'entrada',
      endpoint: `/webhook/${evento}`,
      erro: e instanceof Error ? e.message : 'erro ao processar webhook',
    })
    // Sinaliza falha pra eles reenviarem.
    return FALHA
  }
}
