'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import { Editor } from '@/components/editor'
import { salvarSecaoAjuda, apagarSecaoAjuda } from '../actions'

interface Props {
  inicial?: {
    id: string
    slug: string
    titulo: string
    resumo: string | null
    icone: string | null
    ordem: number
    publicado: boolean
    conteudo_html: string
  } | null
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

export function EditorAjuda({ inicial }: Props) {
  const router = useRouter()
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [slug, setSlug] = useState(inicial?.slug ?? '')
  const [resumo, setResumo] = useState(inicial?.resumo ?? '')
  const [icone, setIcone] = useState(inicial?.icone ?? '')
  const [ordem, setOrdem] = useState(inicial?.ordem ?? 100)
  const [publicado, setPublicado] = useState(inicial?.publicado ?? true)
  const [conteudo, setConteudo] = useState(inicial?.conteudo_html ?? '')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [pending, start] = useTransition()
  const [removendo, startRemove] = useTransition()

  const slugAuto = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const salvar = () => {
    setErro(''); setOk('')
    start(async () => {
      const r = await salvarSecaoAjuda({
        id: inicial?.id,
        slug: slug || slugAuto(titulo),
        titulo,
        resumo: resumo || null,
        icone: icone || null,
        ordem,
        publicado,
        conteudo_html: conteudo,
      })
      if (r.error) { setErro(r.error); return }
      setOk('Salvo.')
      if (!inicial) {
        router.push('/admin/ajuda')
      } else {
        router.refresh()
      }
    })
  }

  const remover = () => {
    if (!inicial?.id) return
    if (!confirm(`Remover "${titulo}"? Não dá pra desfazer.`)) return
    startRemove(async () => {
      const r = await apagarSecaoAjuda(inicial.id)
      if (r.error) { setErro(r.error); return }
      router.push('/admin/ajuda')
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/admin/ajuda" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700">
          <ArrowLeft size={12} /> Ajuda
        </Link>
        <div className="flex items-center gap-2">
          {inicial && (
            <button
              onClick={remover}
              disabled={removendo}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 hover:bg-red-50 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              {removendo ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Remover
            </button>
          )}
          <button
            onClick={salvar}
            disabled={pending}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>

      <h1 className="text-xl font-bold text-gray-900">
        {inicial ? 'Editar seção de ajuda' : 'Nova seção de ajuda'}
      </h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={e => {
                setTitulo(e.target.value)
                if (!inicial) setSlug(slugAuto(e.target.value))
              }}
              className={inputCls}
              placeholder="Ex: Como criar um contrato"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(slugAuto(e.target.value))}
              className={`${inputCls} font-mono`}
              placeholder="contratos"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">
              Usado em <code className="bg-gray-100 px-1 rounded">{'<BotaoAjuda slug="..." />'}</code>
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Resumo</label>
          <input
            type="text"
            value={resumo}
            onChange={e => setResumo(e.target.value)}
            className={inputCls}
            placeholder="Uma linha que aparece na listagem"
            maxLength={120}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ícone (lucide)</label>
            <input
              type="text"
              value={icone}
              onChange={e => setIcone(e.target.value)}
              className={`${inputCls} font-mono`}
              placeholder="HelpCircle"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Nome exato. <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline">Ver lista</a>.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={e => setOrdem(parseInt(e.target.value) || 100)}
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Menor primeiro</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Visibilidade</label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={publicado}
                onChange={e => setPublicado(e.target.checked)}
                className="accent-violet-600"
              />
              <span>{publicado ? 'Publicado' : 'Rascunho'}</span>
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Conteúdo</label>
          <Editor
            value={conteudo}
            onChange={setConteudo}
            placeholder="Explique como usar essa parte do CRM..."
            minHeight={300}
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {ok && <p className="text-sm text-green-700 font-medium">✓ {ok}</p>}
      </div>
    </div>
  )
}
