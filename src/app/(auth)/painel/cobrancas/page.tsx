import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { ListaCobrancas, type CobrancaRow } from './_components/lista-cobrancas'

interface Props {
  searchParams: Promise<{ filtro?: string }>
}

interface ParcelaRow {
  id: string
  numero: number
  vencimento: string
  valor_total: number
  status_pagamento: string
  contrato: {
    id: string
    codigo: string
    inquilino: { id: string; nome: string; telefone: string | null; whatsapp: string | null; email: string | null } | { id: string; nome: string; telefone: string | null; whatsapp: string | null; email: string | null }[] | null
    imovel: { titulo: string; bairro: { nome: string } | { nome: string }[] | null } | { titulo: string; bairro: { nome: string } | { nome: string }[] | null }[] | null
  } | { id: string; codigo: string; inquilino: unknown; imovel: unknown }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function CobrancasPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const sp = await searchParams
  const filtro = sp.filtro ?? 'pendentes'

  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  const em30Dias = new Date(hoje.getTime() + 30 * 86400000)
  const limiteVencimento = em30Dias.toISOString().slice(0, 10)

  // Pega todas as parcelas não pagas até 30 dias à frente
  const [{ data: parcelasRaw }, { data: perfil }] = await Promise.all([
    supabase
      .from('parcelas_aluguel')
      .select(`
        id, numero, vencimento, valor_total, status_pagamento,
        contrato:contratos_locacao!inner(
          id, codigo,
          inquilino:pessoas!inquilino_id(id, nome, telefone, whatsapp, email),
          imovel:imoveis(titulo, bairro:bairros(nome))
        )
      `)
      .eq('contrato.user_id', acesso.userId)
      .neq('status_pagamento', 'pago')
      .lte('vencimento', limiteVencimento)
      .order('vencimento', { ascending: true }),
    supabase
      .from('perfis')
      .select('nome')
      .eq('id', acesso.userId)
      .single(),
  ])

  const anuncianteNome = perfil?.nome ?? 'Imobiliária'
  const parcelas = (parcelasRaw ?? []) as unknown as ParcelaRow[]

  // Transforma em CobrancaRow + calcula dias até vencimento
  const cobrancas: CobrancaRow[] = parcelas
    .map(p => {
      const c = unwrap(p.contrato)
      if (!c) return null
      const inq = unwrap(c.inquilino as ParcelaRow['contrato'] extends infer X ? X extends { inquilino: infer Y } ? Y : never : never)
      const imo = unwrap(c.imovel as ParcelaRow['contrato'] extends infer X ? X extends { imovel: infer Y } ? Y : never : never)
      const bairro = imo ? unwrap((imo as { bairro: unknown }).bairro as { nome: string } | { nome: string }[] | null) : null
      const inquilino = inq as { id: string; nome: string; telefone: string | null; whatsapp: string | null; email: string | null } | null
      if (!inquilino) return null
      const venc = new Date(p.vencimento + 'T00:00:00')
      const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000)
      return {
        id: p.id,
        contratoId: c.id,
        contratoCodigo: c.codigo,
        inquilinoNome: inquilino.nome,
        inquilinoTelefone: inquilino.whatsapp ?? inquilino.telefone,
        inquilinoEmail: inquilino.email,
        imovelTitulo: (imo as { titulo: string } | null)?.titulo ?? null,
        bairroNome: bairro?.nome ?? null,
        vencimento: p.vencimento,
        valor: p.valor_total,
        diasAteVenc: dias,
      } as CobrancaRow
    })
    .filter((c): c is CobrancaRow => c !== null)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle size={20} className="text-green-600" /> Cobranças via WhatsApp
        </h1>
        <p className="text-sm text-gray-500">
          Lista de parcelas pendentes pra você enviar lembrete um por um. Mensagem se adapta automaticamente conforme dias até vencimento.
        </p>
      </div>

      <ListaCobrancas
        cobrancas={cobrancas}
        anuncianteNome={anuncianteNome}
        filtroInicial={filtro}
      />
    </div>
  )
}
