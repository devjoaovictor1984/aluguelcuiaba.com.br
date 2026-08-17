import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarEvento, consultarAnalise } from '@/lib/seguros'
import { gravarPareceres, gravarParecerUnico, resumirStatus } from '@/lib/seguros/pareceres'
import { salvarArquivo } from '@/lib/seguros/arquivos'
import { lerParecer } from '@/lib/seguros/maximiza/mapper'
import { TIPO_ARQUIVO_APOLICE } from '@/lib/seguros/tabelas'
import { lerEstadoAnterior, notificarMudancas } from '@/lib/seguros/notificar'
import { identificarPretendente } from '@/lib/seguros/pretendente'

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

/**
 * Fecha o ciclo da contratação quando a apólice chega.
 *
 * O `/contratar` responde só com uma mensagem — sem número de apólice.
 * Este webhook é o único momento em que sabemos que foi emitida, então é
 * aqui que a contratação vira 'emitida' e o número desce pro contrato de
 * locação, onde o corretor o digitava à mão.
 */
async function marcarApoliceEmitida(
  admin: ReturnType<typeof createAdminClient>,
  analiseId: string,
  sigla: string | null,
  corpo: Record<string, unknown>,
): Promise<void> {
  let q = admin
    .from('seguro_contratacoes')
    .select('id')
    .eq('analise_id', analiseId)
    .eq('status', 'enviada')
  if (sigla) q = q.eq('seguradora_sigla', sigla)

  const { data: contratacao } = await q.maybeSingle()
  if (!contratacao) return

  // A doc não define um campo de número de apólice no webhook; o
  // codigoAnalise da seguradora é o identificador disponível.
  const numero = corpo.codigoAnalise ? String(corpo.codigoAnalise) : null

  await admin.from('seguro_contratacoes').update({
    status: 'emitida',
    apolice_numero: numero,
    emitida_em: new Date().toISOString(),
  }).eq('id', contratacao.id)

  const { data: analise } = await admin
    .from('seguro_analises')
    .select('contrato_id')
    .eq('id', analiseId)
    .maybeSingle()

  if (analise?.contrato_id && numero) {
    await admin.from('contratos_locacao')
      .update({ seguro_fianca_apolice: numero })
      .eq('id', analise.contrato_id)
  }
}

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
    .select('id, user_id, ambiente, payload, inquilino:pessoas!inquilino_id(nome)')
    .eq('maximiza_id', idExterno)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!analise) return FALHA

  // Fotografa antes de escrever, pra saber o que de fato mudou.
  const antes = await lerEstadoAnterior(admin, analise.id)

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
      const sigla = String(corpo.sigla ?? corpo.seguradora ?? '').toLowerCase() || null

      if (base64 && codigoTipo) {
        await salvarArquivo(admin, {
          seguradoraSigla: sigla,
          codigoTipo,
          descricao: corpo.descricaoArquivo ? String(corpo.descricaoArquivo) : null,
          base64,
        }, { userId: analise.user_id, analiseId: analise.id })
      }

      // A apólice é o único sinal de emissão que a API dá: /contratar
      // responde só com uma mensagem, sem número.
      if (codigoTipo === TIPO_ARQUIVO_APOLICE) {
        await marcarApoliceEmitida(admin, analise.id, sigla, corpo)
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

      const inq = Array.isArray(analise.inquilino) ? analise.inquilino[0] : analise.inquilino
      // Quem cotou sem cadastro só tem nome no payload — sem isso a
      // notificação chega falando "o pretendente".
      const quem = identificarPretendente(inq ?? null, analise.payload)
      await notificarMudancas(
        admin,
        { userId: analise.user_id, analiseId: analise.id, nomeInquilino: quem.nome },
        antes,
        resultado.pareceres,
      )
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
