import { Mail, Info } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMPLATES } from '@/lib/email/templates'
import { TemplateForm, type VariavelDoc } from './_components/template-form'

interface TemplateDef {
  chave: 'boas_vindas' | 'aviso_vencimento' | 'aviso_aluguel' | 'anuncio_parado_30d' | 'anuncio_parado_60d'
  titulo: string
  descricao: string
  quandoEnviado: string
  variaveis: VariavelDoc[]
  exemplo: Record<string, string>
}

const TEMPLATES: TemplateDef[] = [
  {
    chave: 'boas_vindas',
    titulo: 'Boas-vindas (cadastro)',
    descricao: 'E-mail de boas-vindas para quem acabou de criar uma conta no site.',
    quandoEnviado: 'Disparo automático no momento do cadastro de novo usuário.',
    variaveis: [
      { nome: 'nome', descricao: 'Nome cadastrado pelo usuário' },
      { nome: 'email', descricao: 'E-mail do usuário' },
      { nome: 'painel_url', descricao: 'URL completa do painel (ex: https://aluguelcuiaba.com.br/painel)' },
    ],
    exemplo: {
      nome: 'João Silva',
      email: 'joao@exemplo.com',
      painel_url: 'https://aluguelcuiaba.com.br/painel',
    },
  },
  {
    chave: 'aviso_vencimento',
    titulo: 'Aviso de vencimento de anúncio',
    descricao: 'Lembrete enviado ao dono do anúncio quando o imóvel está próximo de expirar.',
    quandoEnviado: 'Disparo diário pelo cron 7 dias antes do anúncio vencer.',
    variaveis: [
      { nome: 'nome', descricao: 'E-mail do anunciante (usado como saudação)' },
      { nome: 'titulo', descricao: 'Título do imóvel que está vencendo' },
      { nome: 'dias', descricao: 'Quantos dias faltam pro anúncio vencer (1-7)' },
      { nome: 'painel_url', descricao: 'URL do painel para renovar' },
    ],
    exemplo: {
      nome: 'maria@exemplo.com',
      titulo: 'Apartamento 2 quartos no Centro',
      dias: '3',
      painel_url: 'https://aluguelcuiaba.com.br/painel',
    },
  },
  {
    chave: 'anuncio_parado_30d',
    titulo: 'Anúncio parado há 30 dias',
    descricao: 'Lembrete suave pro anunciante atualizar o anúncio que não recebe edição há 30 dias.',
    quandoEnviado: 'Cron diário verifica imóveis ativos com updated_at < hoje - 30 dias e que ainda não receberam este aviso.',
    variaveis: [
      { nome: 'nome', descricao: 'Nome do anunciante' },
      { nome: 'titulo', descricao: 'Título do imóvel parado' },
      { nome: 'dias', descricao: 'Quantos dias sem atualização (~30+)' },
      { nome: 'painel_url', descricao: 'Link direto para editar o imóvel' },
    ],
    exemplo: {
      nome: 'João Silva',
      titulo: 'Casa 3 quartos no Centro',
      dias: '32',
      painel_url: 'https://aluguelcuiaba.com.br/painel',
    },
  },
  {
    chave: 'anuncio_parado_60d',
    titulo: 'Anúncio parado há 60 dias (firme)',
    descricao: 'Aviso mais firme: 2 meses sem atualização. Pode estar perdendo ranking.',
    quandoEnviado: 'Cron diário verifica imóveis ativos com updated_at < hoje - 60 dias e que ainda não receberam este aviso.',
    variaveis: [
      { nome: 'nome', descricao: 'Nome do anunciante' },
      { nome: 'titulo', descricao: 'Título do imóvel parado' },
      { nome: 'dias', descricao: 'Quantos dias sem atualização (~60+)' },
      { nome: 'painel_url', descricao: 'Link direto para editar o imóvel' },
    ],
    exemplo: {
      nome: 'João Silva',
      titulo: 'Casa 3 quartos no Centro',
      dias: '63',
      painel_url: 'https://aluguelcuiaba.com.br/painel',
    },
  },
  {
    chave: 'aviso_aluguel',
    titulo: 'Aviso de aluguel vencendo (CRM)',
    descricao: 'Lembrete enviado ao inquilino 5 dias antes da parcela do aluguel vencer.',
    quandoEnviado: 'Disparo diário pelo cron (somente para parcelas que vencem em exatamente 5 dias e que ainda não foram pagas).',
    variaveis: [
      { nome: 'nome', descricao: 'Primeiro nome do inquilino' },
      { nome: 'anunciante', descricao: 'Nome do dono do contrato (você ou a imobiliária)' },
      { nome: 'imovel_titulo', descricao: 'Título do imóvel alugado' },
      { nome: 'imovel_bairro', descricao: 'Bairro do imóvel' },
      { nome: 'venc', descricao: 'Data de vencimento formatada (ex: 23/05/2026)' },
      { nome: 'dias', descricao: 'Quantos dias faltam (geralmente 5)' },
      { nome: 'valor', descricao: 'Valor total da parcela em BRL (ex: R$ 1.900,00)' },
    ],
    exemplo: {
      nome: 'Carlos',
      anunciante: 'Imobiliária AluguelCuiabá',
      imovel_titulo: 'Casa 3 quartos com quintal',
      imovel_bairro: 'Bairro Coxipó',
      venc: '23/05/2026',
      dias: '5',
      valor: 'R$ 1.900,00',
    },
  },
]

export default async function AdminEmailsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('site_config')
    .select('chave, valor')
    .like('chave', 'email_%')

  const cfg = Object.fromEntries((data ?? []).map(c => [c.chave, c.valor ?? '']))

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <Mail size={20} className="text-violet-600" />
        <h1 className="text-xl font-bold text-gray-900">Templates de E-mail</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Edite o assunto e o HTML de cada e-mail automático do sistema.
      </p>

      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Info size={16} className="text-violet-600 shrink-0 mt-0.5" />
        <div className="text-xs text-violet-900 leading-relaxed">
          <p className="font-semibold mb-1">Como usar variáveis</p>
          <p>
            Escreva o nome da variável entre chaves duplas no assunto ou no corpo: <code className="bg-white px-1.5 py-0.5 rounded font-mono">{'{{nome_da_variavel}}'}</code>.
            No envio, o sistema substitui pelo valor real (ex: <code className="bg-white px-1.5 py-0.5 rounded font-mono">{'{{nome}}'}</code> → <em>João Silva</em>).
            Se a variável não existir, o resultado fica em branco — vai aparecer a lista de cada template abaixo.
          </p>
          <p className="mt-2">Use <strong>Pré-visualizar</strong> para ver como o e-mail vai chegar antes de salvar. <strong>Restaurar padrão</strong> volta ao HTML original do sistema.</p>
        </div>
      </div>

      <div className="space-y-4">
        {TEMPLATES.map(t => (
          <TemplateForm
            key={t.chave}
            chave={t.chave}
            titulo={t.titulo}
            descricao={t.descricao}
            quandoEnviado={t.quandoEnviado}
            variaveis={t.variaveis}
            exemplo={t.exemplo}
            assuntoInicial={cfg[`email_${t.chave}_assunto`] || DEFAULT_TEMPLATES[t.chave].assunto}
            corpoInicial={cfg[`email_${t.chave}_corpo`] || DEFAULT_TEMPLATES[t.chave].corpo}
            assuntoPadrao={DEFAULT_TEMPLATES[t.chave].assunto}
            corpoPadrao={DEFAULT_TEMPLATES[t.chave].corpo}
          />
        ))}
      </div>
    </div>
  )
}
