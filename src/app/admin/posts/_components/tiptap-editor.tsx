'use client'

import { useEditor, EditorContent } from '@tiptap/react'
// StarterKit já inclui Link e Underline desde tiptap 3.x — importar separado
// dispara "Duplicate extension names found" no console.
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { PreserveAttributes, Div } from './tiptap-preserve'
import { useRef, useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code, Minus,
  Link as LinkIcon, ImageIcon, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Code2, Loader2, Trash2,
} from 'lucide-react'

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
}

function Divider() {
  return <div className="w-px bg-gray-200 mx-0.5 self-stretch" />
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false)
  const [htmlRaw, setHtmlRaw] = useState(content)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { class: 'text-violet-600 underline underline-offset-2' } },
      }),
      Image.configure({ HTMLAttributes: { class: 'rounded-xl max-w-full my-4' } }),
      TableKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Escreva o conteúdo do post aqui...' }),
      // Preservam style/class inline e o nó <div> no round-trip do editor,
      // pra que HTML rico colado (cards, caixas, tabelas) não seja descartado.
      PreserveAttributes,
      Div,
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[420px] p-6 text-gray-900 text-sm leading-relaxed',
      },
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href ?? ''
    const url = window.prompt('URL do link:', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const insertImage = useCallback((url: string) => {
    editor?.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `posts/${Date.now()}.${ext}`
      const { error, data } = await supabase.storage.from('post-images').upload(path, file, { upsert: true })
      if (error) { alert(`Erro ao enviar imagem: ${error.message}`); return }
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(data.path)
      insertImage(publicUrl)
    } finally {
      setUploading(false)
    }
  }

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const switchToHtml = () => {
    if (editor) setHtmlRaw(editor.getHTML())
    setHtmlMode(true)
  }

  const switchToVisual = () => {
    if (editor) {
      editor.commands.setContent(htmlRaw, { emitUpdate: false })
      onChange(htmlRaw)
    }
    setHtmlMode(false)
  }

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor) return null

  const Btn = ({
    onClick, active, title, disabled, children,
  }: {
    onClick: () => void; active?: boolean; title: string; disabled?: boolean; children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-40 ${
        active
          ? 'bg-violet-100 text-violet-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      {!htmlMode && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-100 bg-gray-50">
          {/* History */}
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer" disabled={!editor.can().undo()}>
            <Undo size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer" disabled={!editor.can().redo()}>
            <Redo size={13} />
          </Btn>
          <Divider />

          {/* Text style */}
          <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito">
            <Bold size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico">
            <Italic size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado">
            <UnderlineIcon size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
            <Strikethrough size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código inline">
            <Code size={13} />
          </Btn>
          <Divider />

          {/* Headings */}
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título H2">
            <Heading2 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título H3">
            <Heading3 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })} title="Título H4">
            <Heading4 size={13} />
          </Btn>
          <Divider />

          {/* Align */}
          <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar esquerda">
            <AlignLeft size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
            <AlignCenter size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar direita">
            <AlignRight size={13} />
          </Btn>
          <Divider />

          {/* Lists & blocks */}
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
            <List size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
            <ListOrdered size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação">
            <Quote size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Bloco de código">
            <Code2 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
            <Minus size={13} />
          </Btn>
          <Divider />

          {/* Link */}
          <Btn onClick={setLink} active={editor.isActive('link')} title="Link">
            <LinkIcon size={13} />
          </Btn>

          {/* Image upload */}
          <Btn onClick={() => fileRef.current?.click()} title="Inserir imagem" disabled={uploading}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }}
          />

          {/* Table */}
          <Btn onClick={insertTable} title="Inserir tabela" active={editor.isActive('table')}>
            <TableIcon size={13} />
          </Btn>

          {/* Table controls (visible when cursor is inside table) */}
          {editor.isActive('table') && (
            <>
              <Divider />
              <span className="text-[10px] text-gray-400 px-1">Tabela:</span>
              <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">+Col</button>
              <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">-Col</button>
              <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">+Lin</button>
              <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">-Lin</button>
              <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-0.5">
                <Trash2 size={10} />Tabela
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* HTML mode toggle */}
          <button
            type="button"
            onClick={switchToHtml}
            className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
          >
            &lt;/&gt; HTML
          </button>
        </div>
      )}

      {/* HTML mode toolbar */}
      {htmlMode && (
        <div className="flex items-center justify-between p-2 border-b border-amber-200 bg-amber-50">
          <span className="text-xs text-amber-700 font-medium">Modo HTML — edite o código diretamente</span>
          <button
            type="button"
            onClick={switchToVisual}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            ← Visual
          </button>
        </div>
      )}

      {/* Editor content */}
      {htmlMode ? (
        <textarea
          value={htmlRaw}
          onChange={e => { setHtmlRaw(e.target.value); onChange(e.target.value) }}
          className="w-full min-h-[420px] p-6 font-mono text-xs text-gray-800 focus:outline-none resize-y bg-gray-950 text-green-400"
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}

    </div>
  )
}
