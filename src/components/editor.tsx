'use client'

import { useEditor, EditorContent } from '@tiptap/react'
// StarterKit já inclui Link e Underline desde tiptap 3.x — importar separado
// dispara "Duplicate extension names found" no console.
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Bold, Italic, Underline as UIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Image as ImageIcon,
  Link as LinkIcon, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Eraser, Minus, Undo2, Redo2, Code2,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

function Div() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />
}

function Btn({
  onClick, active = false, title, children, disabled = false,
}: {
  onClick: () => void; active?: boolean; title: string
  children: React.ReactNode; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded text-xs font-semibold transition-colors select-none ${
        active
          ? 'bg-violet-100 text-violet-700'
          : 'text-gray-600 hover:bg-gray-100 disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  )
}

export function Editor({ value, onChange, placeholder = 'Descreva o imóvel...', minHeight = 200 }: Props) {
  const [showHTML, setShowHTML] = useState(false)
  const [rawHTML, setRawHTML] = useState(value)
  const colorRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      const html = editor.getHTML()
      setRawHTML(html)
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror px-4 py-3 text-sm text-gray-900',
        style: `min-height:${minHeight}px`,
      },
    },
    immediatelyRender: false,
  })

  // Sync from outside if value changes without editor interaction
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '')
  }, [value]) // eslint-disable-line

  const insertImage = useCallback(() => {
    const url = window.prompt('URL da imagem:')
    if (url) editor?.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const setLink = useCallback(() => {
    if (editor?.isActive('link')) { editor.chain().focus().unsetLink().run(); return }
    const url = window.prompt('URL do link:')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const applyRawHTML = useCallback(() => {
    editor?.commands.setContent(rawHTML)
    setShowHTML(false)
    onChange(rawHTML)
  }, [editor, rawHTML, onChange])

  if (!editor) return null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">

        {/* History */}
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer" disabled={!editor.can().undo()}>
          <Undo2 size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer" disabled={!editor.can().redo()}>
          <Redo2 size={13} />
        </Btn>

        <Div />

        {/* Inline formatting */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito">
          <Bold size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico">
          <Italic size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado">
          <UIcon size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
          <Strikethrough size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código inline">
          <Code size={13} />
        </Btn>

        <Div />

        {/* Headings */}
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
          <span className="text-[11px] font-bold">H2</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
          <span className="text-[11px] font-bold">H3</span>
        </Btn>

        <Div />

        {/* Lists */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista com marcadores">
          <List size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered size={13} />
        </Btn>

        <Div />

        {/* Blocks */}
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação">
          <Quote size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Bloco de código">
          <Code2 size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
          <Minus size={13} />
        </Btn>

        <Div />

        {/* Media */}
        <Btn onClick={setLink} active={editor.isActive('link')} title="Link">
          <LinkIcon size={13} />
        </Btn>
        <Btn onClick={insertImage} title="Imagem (URL)">
          <ImageIcon size={13} />
        </Btn>
        <Btn onClick={insertTable} title="Inserir tabela">
          <TableIcon size={13} />
        </Btn>

        <Div />

        {/* Align */}
        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar à esquerda">
          <AlignLeft size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
          <AlignCenter size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar à direita">
          <AlignRight size={13} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar">
          <AlignJustify size={13} />
        </Btn>

        <Div />

        {/* Color */}
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); colorRef.current?.click() }}
          title="Cor do texto"
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="w-3.5 h-3.5 rounded-sm border border-gray-300" style={{ background: editor.getAttributes('textStyle').color || '#000' }} />
          <input
            ref={colorRef}
            type="color"
            className="sr-only"
            defaultValue="#000000"
            onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
          />
        </button>

        <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Remover formatação">
          <Eraser size={13} />
        </Btn>

        <Div />

        {/* HTML toggle */}
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault()
            if (!showHTML) { setRawHTML(editor.getHTML()); setShowHTML(true) }
            else applyRawHTML()
          }}
          title="Editar HTML"
          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${showHTML ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {'</>'}
        </button>
      </div>

      {/* ── Content ── */}
      {showHTML ? (
        <textarea
          value={rawHTML}
          onChange={e => setRawHTML(e.target.value)}
          onBlur={applyRawHTML}
          className="w-full font-mono text-xs text-gray-800 px-4 py-3 outline-none resize-none bg-orange-50"
          style={{ minHeight }}
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}
