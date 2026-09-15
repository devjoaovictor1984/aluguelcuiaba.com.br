'use client'

import {
  TermosAditivosSecao, type TermoAditivoRow, type TermoAditivoInput, type PessoaTestemunha, type TipoTermo,
} from '@/components/crm/termos-aditivos-secao'
import { criarAditivoAdm, atualizarAditivoAdm, excluirAditivoAdm, type TipoAditivoAdm } from '../actions-aditivos-adm'

export type AditivoAdmRow = TermoAditivoRow

const TIPOS: TipoTermo[] = [
  { valor: 'taxa', label: 'Alteração da taxa de administração', modelo: 'Fica alterada a taxa de administração de ___ para ___, a partir de ___.' },
  { valor: 'prorrogacao', label: 'Prorrogação de prazo', modelo: 'Fica prorrogado o prazo do contrato de administração por mais ___ meses, passando o término para ___, mantidas as demais condições.' },
  { valor: 'exclusividade', label: 'Alteração de exclusividade', modelo: 'Fica alterado o regime de exclusividade para ___, a partir de ___.' },
  { valor: 'repasse', label: 'Alteração de repasse', modelo: 'Fica alterada a forma/data de repasse de ___ para ___.' },
  { valor: 'clausula', label: 'Inclusão / alteração de cláusula', modelo: 'Fica incluída/alterada a seguinte disposição: ___.' },
  { valor: 'outro', label: 'Outro', modelo: '' },
]

const comTipo = (i: TermoAditivoInput) => ({ ...i, tipo: i.tipo as TipoAditivoAdm })

export function AditivosAdmSecao({ contratoId, aditivos, pessoas }: {
  contratoId: string
  aditivos: AditivoAdmRow[]
  /** Cadastro de pessoas, pra escolher as testemunhas. */
  pessoas: PessoaTestemunha[]
}) {
  return (
    <TermosAditivosSecao
      contratoId={contratoId}
      aditivos={aditivos}
      pessoas={pessoas}
      tipos={TIPOS}
      pdfBase="/api/contratos-admin/aditivos"
      textoVazio="Nenhum aditivo. Use depois que o contrato de administração já está assinado e algo precisa mudar — alteração de taxa, prorrogação de prazo, mudança de exclusividade ou inclusão de cláusula. Gera um PDF próprio que referencia o contrato e é assinado pela administradora e proprietária."
      subtitulo="Vincula ao contrato de administração e gera um PDF assinável. As demais cláusulas permanecem inalteradas."
      placeholderTitulo="Ex: Nova taxa 2027"
      criar={i => criarAditivoAdm(comTipo(i))}
      atualizar={(id, i) => atualizarAditivoAdm(id, comTipo(i))}
      excluir={excluirAditivoAdm}
    />
  )
}
