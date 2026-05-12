import { Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMPLATES } from '@/lib/email/templates'
import { TemplateForm } from './_components/template-form'

const TEMPLATES = [
  {
    chave: 'boas_vindas',
    titulo: 'Boas-vindas',
    descricao: 'Enviado automaticamente quando alguém cria uma conta.',
    variaveis: ['nome', 'email', 'painel_url'],
  },
  {
    chave: 'aviso_vencimento',
    titulo: 'Aviso de vencimento',
    descricao: 'Enviado quando um anúncio está próximo de vencer.',
    variaveis: ['nome', 'titulo', 'dias', 'painel_url'],
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
      <p className="text-sm text-gray-500 mb-6">
        Edite o assunto e o corpo HTML de cada e-mail automático. Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{variavel}}'}</code> para inserir dados dinâmicos.
      </p>

      <div className="space-y-4">
        {TEMPLATES.map(t => (
          <TemplateForm
            key={t.chave}
            chave={t.chave}
            titulo={t.titulo}
            descricao={t.descricao}
            variaveis={t.variaveis}
            assuntoInicial={cfg[`email_${t.chave}_assunto`] || DEFAULT_TEMPLATES[t.chave].assunto}
            corpoInicial={cfg[`email_${t.chave}_corpo`] || DEFAULT_TEMPLATES[t.chave].corpo}
          />
        ))}
      </div>
    </div>
  )
}
