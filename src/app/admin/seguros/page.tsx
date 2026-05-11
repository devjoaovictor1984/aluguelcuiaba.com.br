import { ShieldCheck, Flame, UserCheck, Clock } from 'lucide-react'

const SEGUROS = [
  {
    id: 'incendio',
    titulo: 'Seguro Incêndio',
    descricao: 'Proteção contra incêndio, raio e explosão. Obrigatório em contratos de locação pela Lei do Inquilinato.',
    icon: Flame,
    cor: 'bg-orange-50',
    iconCor: 'text-orange-500',
  },
  {
    id: 'fianca',
    titulo: 'Seguro Fiança',
    descricao: 'Substitui o fiador tradicional. Garante ao proprietário o pagamento do aluguel em caso de inadimplência.',
    icon: UserCheck,
    cor: 'bg-blue-50',
    iconCor: 'text-blue-500',
  },
]

export default function AdminSegurosPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seguros</h1>
          <p className="text-gray-500 text-sm mt-1">Parceria com seguradoras para oferecer seguros diretamente na plataforma.</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
          <Clock size={12} />
          Em desenvolvimento
        </span>
      </div>

      {/* Status banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 mb-8 flex items-start gap-3">
        <ShieldCheck size={20} className="text-violet-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-violet-900">Integração com seguradoras em planejamento</p>
          <p className="text-xs text-violet-700 mt-0.5">
            Quando firmada a parceria, os seguros aparecerão automaticamente no fluxo de contato do imóvel
            e nas páginas de contratos. Configure os produtos abaixo.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {SEGUROS.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className={`w-12 h-12 ${s.cor} rounded-xl flex items-center justify-center mb-4`}>
              <s.icon size={22} className={s.iconCor} />
            </div>
            <h2 className="font-bold text-gray-900 mb-1">{s.titulo}</h2>
            <p className="text-sm text-gray-500 mb-4">{s.descricao}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                Parceiro: a definir
              </span>
              <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-medium">
                Inativo
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Configuração futura */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Configurações</h2>
        <div className="space-y-4 opacity-50 pointer-events-none">
          {['URL da API da seguradora', 'Chave de integração', 'Comissão (%)', 'Ativo para usuários'].map(campo => (
            <div key={campo}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{campo}</label>
              <div className="h-10 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Disponível após parceria com seguradora</p>
      </div>
    </div>
  )
}
