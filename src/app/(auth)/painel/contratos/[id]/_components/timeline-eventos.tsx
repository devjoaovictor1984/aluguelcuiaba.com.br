'use client'

import { useState } from 'react'
import {
  Clock, FilePlus, FileEdit, FileX, RefreshCw, Repeat,
  CheckCircle2, X, DollarSign, Shield, Send, TrendingUp,
  UserPlus, UserMinus, FileText, Paperclip, ChevronDown, ChevronUp,
} from 'lucide-react'

export interface EventoRow {
  id: string
  tipo: string
  descricao: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface Props {
  eventos: EventoRow[]
}

const TIPO_INFO: Record<string, { icone: React.ElementType; cor: string; bg: string; rotulo: string }> = {
  contrato_criado:           { icone: FilePlus,    cor: 'text-violet-700', bg: 'bg-violet-100', rotulo: 'Criação' },
  contrato_atualizado:       { icone: FileEdit,    cor: 'text-gray-600',   bg: 'bg-gray-100',   rotulo: 'Alteração' },
  contrato_encerrado:        { icone: FileX,       cor: 'text-red-700',    bg: 'bg-red-100',    rotulo: 'Encerramento' },
  contrato_renovado:         { icone: Repeat,      cor: 'text-green-700',  bg: 'bg-green-100',  rotulo: 'Renovação' },
  pagamento_registrado:      { icone: CheckCircle2, cor: 'text-green-700', bg: 'bg-green-100',  rotulo: 'Pagamento' },
  pagamento_desfeito:        { icone: X,           cor: 'text-amber-700',  bg: 'bg-amber-100',  rotulo: 'Pgto desfeito' },
  repasse_pago:              { icone: DollarSign,  cor: 'text-blue-700',   bg: 'bg-blue-100',   rotulo: 'Repasse' },
  repasse_desfeito:          { icone: X,           cor: 'text-amber-700',  bg: 'bg-amber-100',  rotulo: 'Repasse desfeito' },
  seguro_pago:               { icone: Shield,      cor: 'text-blue-700',   bg: 'bg-blue-100',   rotulo: 'Seguro' },
  seguro_desfeito:           { icone: X,           cor: 'text-amber-700',  bg: 'bg-amber-100',  rotulo: 'Seguro desfeito' },
  boleto_enviado:            { icone: Send,        cor: 'text-violet-700', bg: 'bg-violet-100', rotulo: 'Boleto enviado' },
  boleto_desfeito:           { icone: X,           cor: 'text-gray-500',   bg: 'bg-gray-100',   rotulo: 'Boleto desmarcado' },
  reajuste_aplicado:         { icone: TrendingUp,  cor: 'text-amber-700',  bg: 'bg-amber-100',  rotulo: 'Reajuste' },
  parcelas_regeneradas:      { icone: RefreshCw,   cor: 'text-amber-700',  bg: 'bg-amber-100',  rotulo: 'Regeneração' },
  morador_adicionado:        { icone: UserPlus,    cor: 'text-violet-700', bg: 'bg-violet-100', rotulo: 'Pessoa vinculada' },
  morador_removido:          { icone: UserMinus,   cor: 'text-gray-500',   bg: 'bg-gray-100',   rotulo: 'Pessoa removida' },
  documento_pessoal_anexado: { icone: Paperclip,   cor: 'text-violet-700', bg: 'bg-violet-100', rotulo: 'Documento' },
  documento_pessoal_removido:{ icone: X,           cor: 'text-gray-500',   bg: 'bg-gray-100',   rotulo: 'Documento removido' },
  observacao_manual:         { icone: FileText,    cor: 'text-gray-600',   bg: 'bg-gray-100',   rotulo: 'Observação' },
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${data} · ${hora}`
}

export function TimelineEventos({ eventos }: Props) {
  const [aberto, setAberto] = useState(false)
  const LIMITE = 8
  const mostrar = aberto ? eventos : eventos.slice(0, LIMITE)
  const restantes = eventos.length - LIMITE

  if (eventos.length === 0) {
    return null
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        <Clock size={14} className="text-violet-600" />
        Histórico do contrato
        <span className="text-xs font-normal text-gray-400">({eventos.length})</span>
      </h2>

      <ol className="relative border-l-2 border-gray-100 ml-3">
        {mostrar.map(ev => {
          const info = TIPO_INFO[ev.tipo] ?? { icone: FileText, cor: 'text-gray-500', bg: 'bg-gray-100', rotulo: ev.tipo }
          const Icone = info.icone
          return (
            <li key={ev.id} className="mb-3 ml-4 last:mb-0">
              <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 ${info.bg} rounded-full`}>
                <Icone size={11} className={info.cor} />
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900">{ev.descricao}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    <span className={`${info.cor} font-medium`}>{info.rotulo}</span> · {fmtDataHora(ev.created_at)}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {restantes > 0 && (
        <button
          onClick={() => setAberto(!aberto)}
          className="mt-2 text-xs text-violet-700 hover:text-violet-800 flex items-center gap-1 font-medium"
        >
          {aberto
            ? <>Mostrar menos <ChevronUp size={11} /></>
            : <>Ver mais {restantes} evento{restantes === 1 ? '' : 's'} <ChevronDown size={11} /></>}
        </button>
      )}
    </section>
  )
}
