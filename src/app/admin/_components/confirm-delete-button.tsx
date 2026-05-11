'use client'

import { useRef } from 'react'

interface Props {
  action: () => Promise<void>
  mensagem?: string
  children: React.ReactNode
  className?: string
}

export function ConfirmDeleteButton({ action, mensagem = 'Confirmar exclusão?', children, className }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <form ref={formRef} action={action}>
      <button
        type="button"
        className={className}
        onClick={() => { if (confirm(mensagem)) formRef.current?.requestSubmit() }}
      >
        {children}
      </button>
    </form>
  )
}
