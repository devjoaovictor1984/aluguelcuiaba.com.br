import Link from 'next/link'
import { Cake, MessageCircle, Phone, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { gerarLinkWhatsApp } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const TIPO_LABEL: Record<string, string> = {
  proprietario: 'Proprietário',
  inquilino: 'Inquilino',
  fiador: 'Fiador',
  testemunha: 'Testemunha',
  outro: 'Outro',
}
const TIPO_COR: Record<string, string> = {
  proprietario: 'bg-amber-100 text-amber-700',
  inquilino: 'bg-violet-100 text-violet-700',
  fiador: 'bg-blue-100 text-blue-700',
  testemunha: 'bg-gray-100 text-gray-600',
  outro: 'bg-gray-100 text-gray-600',
}

interface Pessoa {
  id: string
  nome: string
  tipo: string
  telefone: string | null
  whatsapp: string | null
  data_nascimento: string  // YYYY-MM-DD
}

function calcularIdade(nascimento: string, ano: number): number {
  const [y] = nascimento.split('-').map(Number)
  return ano - y
}

function diaDoMes(nascimento: string): number {
  const [, , d] = nascimento.split('-').map(Number)
  return d
}

function templateAniversario(nome: string, anunciante: string): string {
  const primeiroNome = nome.split(' ')[0]
  return `Olá ${primeiroNome}! 🎉

A ${anunciante} te deseja um feliz aniversário!

Que seu novo ciclo de vida seja repleto de saúde, paz e muitas conquistas. 🥳🎂`
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const sp = await searchParams
  const hoje = new Date()
  const mes = Math.min(12, Math.max(1, parseInt(sp.mes ?? '') || (hoje.getMonth() + 1)))
  const ano = Math.min(2100, Math.max(2000, parseInt(sp.ano ?? '') || hoje.getFullYear()))

  // Pessoas com nascimento — filtragem por mês feita no Node (volume pequeno)
  const [{ data: pessoasRaw }, { data: perfil }] = await Promise.all([
    supabase
      .from('pessoas')
      .select('id, nome, tipo, telefone, whatsapp, data_nascimento')
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .not('data_nascimento', 'is', null),
    supabase
      .from('perfis')
      .select('nome')
      .eq('id', acesso.userId)
      .single(),
  ])

  const nomeAnunciante = perfil?.nome ?? 'AluguelCuiabá'

  const aniversariantes: Pessoa[] = ((pessoasRaw ?? []) as Pessoa[])
    .filter(p => {
      const m = parseInt(p.data_nascimento.slice(5, 7))
      return m === mes
    })
    .sort((a, b) => diaDoMes(a.data_nascimento) - diaDoMes(b.data_nascimento))

  const diaHoje = hoje.getDate()
  const mesHoje = hoje.getMonth() + 1
  const isMesAtual = mes === mesHoje && ano === hoje.getFullYear()

  // Navegação mes/ano
  const prevMes = mes === 1 ? 12 : mes - 1
  const prevAno = mes === 1 ? ano - 1 : ano
  const proxMes = mes === 12 ? 1 : mes + 1
  const proxAno = mes === 12 ? ano + 1 : ano

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Cake size={20} className="text-pink-600" /> Aniversariantes
        </h1>
        <p className="text-sm text-gray-500">Proprietários e inquilinos que fazem aniversário no mês escolhido.</p>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-2 w-fit">
        <Link
          href={`/painel/agenda?mes=${prevMes}&ano=${prevAno}`}
          className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="px-4 text-center min-w-[140px]">
          <p className="text-sm font-semibold text-gray-900">{MESES[mes - 1]} {ano}</p>
          {!isMesAtual && (
            <Link href="/painel/agenda" className="text-[10px] text-violet-700 hover:underline">voltar para hoje</Link>
          )}
        </div>
        <Link
          href={`/painel/agenda?mes=${proxMes}&ano=${proxAno}`}
          className="w-9 h-9 rounded-lg hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </Link>
      </div>

      {aniversariantes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Cake size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum aniversariante em {MESES[mes - 1]}.</p>
          <p className="text-xs text-gray-400 mt-1">
            Cadastre a data de nascimento nas fichas das pessoas pra ver elas aqui.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aniversariantes.map(p => {
            const dia = diaDoMes(p.data_nascimento)
            const idade = calcularIdade(p.data_nascimento, ano)
            const ehHoje = isMesAtual && dia === diaHoje
            const passou = isMesAtual && dia < diaHoje
            const numeroWpp = p.whatsapp ?? p.telefone

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                  ehHoje
                    ? 'border-pink-200 bg-gradient-to-br from-pink-50 to-white'
                    : passou
                      ? 'border-gray-100 opacity-60'
                      : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-baseline gap-2">
                    <div className={`text-3xl font-bold leading-none ${ehHoje ? 'text-pink-600' : 'text-gray-900'}`}>
                      {String(dia).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      {MESES[mes - 1].slice(0, 3)}
                    </div>
                  </div>
                  {ehHoje && (
                    <span className="text-[10px] bg-pink-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                      HOJE 🎂
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <Link
                    href={`/painel/clientes/${p.id}`}
                    className="font-semibold text-gray-900 hover:text-violet-700 inline-flex items-center gap-1 text-sm"
                  >
                    {p.nome}
                    <ExternalLink size={11} className="text-gray-300" />
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIPO_COR[p.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPO_LABEL[p.tipo] ?? p.tipo}
                    </span>
                    <span className="text-[11px] text-gray-500">faz {idade} anos</span>
                  </div>
                </div>

                <div className="flex gap-1 pt-2 border-t border-gray-50">
                  {numeroWpp ? (
                    <a
                      href={gerarLinkWhatsApp(numeroWpp, templateAniversario(p.nome, nomeAnunciante))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <MessageCircle size={12} /> Parabenizar
                    </a>
                  ) : (
                    <span className="flex-1 text-center text-[11px] text-gray-400 italic py-1.5">
                      sem WhatsApp cadastrado
                    </span>
                  )}
                  {p.telefone && (
                    <a
                      href={`tel:${p.telefone.replace(/\D/g, '')}`}
                      title={`Ligar ${p.telefone}`}
                      className="w-9 flex items-center justify-center text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                    >
                      <Phone size={13} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
