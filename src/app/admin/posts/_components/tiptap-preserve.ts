// Faz o TipTap PRESERVAR estilos inline e <div> ao converter HTML → documento
// interno → HTML de novo (o round-trip do editor).
//
// Por padrão o ProseMirror descarta qualquer atributo/tag fora do seu esquema:
// `style="..."`, `class`, `<div>` etc. somem quando você abre um post rico no
// modo visual. Estas extensões registram esses atributos e o nó <div> para que
// o HTML colado (cards, caixas coloridas, tabelas estilizadas, containers de
// gráfico) continue igual depois de salvar e reabrir.
//
// Limitação conhecida: um <div> com conteúdo só inline (ex: barra com dois
// <strong> lado a lado usando flex) tem o inline embrulhado num <p> pelo
// ProseMirror — pode reflowar ao abrir no visual, mas NÃO é mais destruído.

import { Node, Extension } from '@tiptap/core'
import type { Attributes } from '@tiptap/core'

// Atributos que queremos manter em qualquer tag: o style inline e a classe.
const styleAndClass: Attributes = {
  style: {
    default: null,
    parseHTML: (el) => el.getAttribute('style'),
    renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
  },
  class: {
    default: null,
    parseHTML: (el) => el.getAttribute('class'),
    renderHTML: (attrs) => (attrs.class ? { class: attrs.class } : {}),
  },
}

// Cola style/class nos nós que o StarterKit + TableKit já conhecem.
export const PreserveAttributes = Extension.create({
  name: 'preserveAttributes',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph', 'heading', 'blockquote',
          'bulletList', 'orderedList', 'listItem',
          'horizontalRule', 'image', 'codeBlock',
          'table', 'tableRow', 'tableHeader', 'tableCell',
        ],
        attributes: styleAndClass,
      },
    ]
  },
})

// Nó genérico de <div> — sobrevive como container de blocos (caixas coloridas,
// wrappers de tabela/gráfico). content 'block*' permite div vazia (ex: a barra
// preenchida do gráfico, que é uma div só com largura no style).
export const Div = Node.create({
  name: 'div',
  group: 'block',
  content: 'block*',
  defining: true,
  addAttributes() {
    return styleAndClass
  },
  parseHTML() {
    return [{ tag: 'div' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0]
  },
})
