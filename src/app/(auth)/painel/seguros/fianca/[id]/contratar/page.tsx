import Link from 'next/link'
import { ArrowLeft, FileSignature, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { statusAprovado, statusPreAprovado } from '@/lib/seguros/tabelas'
import { FormContratacao } from './_components/form-contratacao'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ seguradora?: string }>
}

export const metadata = { title: 'Contratar seguro fiança' }

export default async function ContratarPage({ params, searchParams }: Props) {
  const { id } = await params
  const { seguradora } = await searchParams
  const acesso = await exigirAcessoSeguros()
  const supabase = await createClient()

  const { data: analise } = await supabase
    .from('seguro_analises')
    .select(`
      id, maximiza_id, ambiente, valor_aluguel, payload, contrato_id, imovel_id,
      inquilino:pessoas!inquilino_id(nome),
      imovel:imoveis(endereco_completo, endereco_resumido, endereco_numero, endereco_cep, bairro:bairros(nome)),
      contrato:contratos_locacao(
        codigo, data_inicio, data_termino, duracao_meses, indice_reajuste,
        condominio_mensal, iptu_mensal,
        proprietario:pessoas!proprietario_id(nome, cpf_cnpj, rg, data_nascimento, estado_civil)
      )
    `)
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!analise) return <Erro id={id} texto="Esta cotação não existe ou pertence a outra conta." />
  if (!analise.maximiza_id) return <Erro id={id} texto="Esta cotação ainda não foi transmitida à corretora." />

  const { data: pareceres } = await supabase
    .from('seguro_analise_pareceres')
    .select('seguradora_sigla, seguradora_nome, codigo_status, limite_aprovado')
    .eq('analise_id', id)

  const aprovados = (pareceres ?? []).filter(p => statusAprovado(p.codigo_status))
  if (aprovados.length === 0) {
    const preAprovados = (pareceres ?? []).filter(p => statusPreAprovado(p.codigo_status))
    return (
      <Erro
        id={id}
        texto={preAprovados.length > 0
          ? 'A análise está pré-aprovada: a parte financeira passou, mas a identidade do pretendente ainda não foi conferida. Mande o link da biometria para ele — quando o parecer virar aprovado, a contratação abre aqui. Enquanto isso, a análise ainda pode ser recusada.'
          : 'Nenhuma seguradora aprovou esta análise ainda. A contratação só é liberada após aprovação.'}
      />
    )
  }

  // Já existe contratação em andamento?
  const { data: jaContratado } = await supabase
    .from('seguro_contratacoes')
    .select('id, seguradora_sigla, status')
    .eq('analise_id', id)
    .in('status', ['enviada', 'emitida'])
    .maybeSingle()

  if (jaContratado) {
    return (
      <Erro
        id={id}
        texto={`Esta cotação já tem contratação ${
          jaContratado.status === 'emitida' ? 'emitida' : 'em andamento'
        } na ${jaContratado.seguradora_sigla.toUpperCase()}.`}
      />
    )
  }

  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const inq = um<{ nome: string }>(analise.inquilino)
  const imovel = um<{
    endereco_completo: string | null
    endereco_resumido: string | null
    endereco_numero: string | null
    endereco_cep: string | null
    bairro: unknown
  }>(analise.imovel)
  const bairro = um<{ nome: string }>(imovel?.bairro)
  const contrato = um<{
    codigo: string
    data_inicio: string
    data_termino: string | null
    duracao_meses: number | null
    indice_reajuste: string | null
    condominio_mensal: number | null
    iptu_mensal: number | null
    proprietario: unknown
  }>(analise.contrato)
  const proprietario = um<{
    nome: string
    cpf_cnpj: string | null
    rg: string | null
    data_nascimento: string | null
    estado_civil: string | null
  }>(contrato?.proprietario)

  const payloadImovel = (analise.payload as { imovel?: Record<string, number> })?.imovel ?? {}

  const enderecoLinha = [
    imovel?.endereco_completo ?? imovel?.endereco_resumido,
    imovel?.endereco_numero,
  ].filter(Boolean).join(', ')

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href={`/painel/seguros/fianca/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Voltar à cotação
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileSignature size={20} className="text-violet-600" /> Contratar seguro fiança
        </h1>
        <p className="text-sm text-gray-500">
          {inq?.nome ?? 'Inquilino'}
          {contrato?.codigo && <> · Contrato {contrato.codigo}</>}
        </p>
      </div>

      {analise.ambiente === 2 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <strong>Ambiente de homologação.</strong> Nada aqui emite apólice de
          verdade — serve para testar o fluxo.
        </p>
      )}

      <FormContratacao
        analiseId={id}
        seguradoras={aprovados.map(p => ({
          sigla: p.seguradora_sigla,
          nome: p.seguradora_nome ?? p.seguradora_sigla.toUpperCase(),
          limiteAprovado: p.limite_aprovado,
        }))}
        seguradoraInicial={seguradora ?? aprovados[0].seguradora_sigla}
        valorAluguel={analise.valor_aluguel}
        encargosIniciais={{
          condominio: contrato?.condominio_mensal ?? payloadImovel.condominio ?? 0,
          iptu: contrato?.iptu_mensal ?? payloadImovel.iptu ?? 0,
          gas: payloadImovel.gas ?? 0,
          energia: payloadImovel.energia ?? 0,
          agua: payloadImovel.agua ?? 0,
        }}
        vigenciaInicial={{
          inicio: contrato?.data_inicio ?? '',
          fim: contrato?.data_termino ?? '',
          meses: contrato?.duracao_meses ?? 30,
          indice: contrato?.indice_reajuste ?? null,
        }}
        imovelInicial={{
          cep: imovel?.endereco_cep ?? String(payloadImovel.cep ?? ''),
          endereco: enderecoLinha,
          bairro: bairro?.nome ?? '',
          cidade: 'Cuiabá',
          uf: 'MT',
        }}
        proprietarioInicial={proprietario ? {
          nome: proprietario.nome,
          cpfCnpj: proprietario.cpf_cnpj ?? '',
          rg: proprietario.rg ?? '',
          dataNascimento: proprietario.data_nascimento ?? '',
          estadoCivil: proprietario.estado_civil ?? '',
        } : null}
      />
    </div>
  )
}

function Erro({ id, texto }: { id: string; texto: string }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href={`/painel/seguros/fianca/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar à cotação
      </Link>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <h1 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
          <AlertOctagon size={18} /> Contratação indisponível
        </h1>
        <p className="text-sm text-amber-900">{texto}</p>
      </div>
    </div>
  )
}
