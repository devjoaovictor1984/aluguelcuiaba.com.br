'use client'

import {
  TermosAditivosSecao, type TermoAditivoRow, type TermoAditivoInput, type PessoaTestemunha, type TipoTermo,
  type AssinaturaAditivos,
} from '@/components/crm/termos-aditivos-secao'
import { criarAditivo, atualizarAditivo, excluirAditivo, type TipoAditivo } from '../actions-aditivos'

export type AditivoRow = TermoAditivoRow

const TIPOS: TipoTermo[] = [
  { valor: 'reajuste', label: 'Reajuste de aluguel', modelo: 'Fica reajustado o valor do aluguel mensal de R$ ___ para R$ ___ (___), com base no índice ___ acumulado no período, a partir de ___.' },
  { valor: 'prorrogacao', label: 'Prorrogação de prazo', modelo: 'Fica prorrogado o prazo de locação por mais ___ meses, passando o término para ___, mantidas as demais condições.' },
  { valor: 'garantia', label: 'Alteração de garantia', modelo: 'Fica alterada a modalidade de garantia locatícia de ___ para ___, conforme ___.' },
  { valor: 'valor', label: 'Alteração de valor / encargos', modelo: 'Fica alterado o valor de ___ para R$ ___ (___), a partir de ___.' },
  { valor: 'clausula', label: 'Inclusão / alteração de cláusula', modelo: 'Fica incluída/alterada a seguinte disposição: ___.' },
  { valor: 'outro', label: 'Outro', modelo: '' },
]

const comTipo = (i: TermoAditivoInput) => ({ ...i, tipo: i.tipo as TipoAditivo })

export function AditivosSecao({ contratoId, codigoContrato, originarioPadrao, cidadeUf, aditivos, pessoas, assinatura }: {
  contratoId: string
  codigoContrato: string
  originarioPadrao: string | null
  cidadeUf: string
  aditivos: AditivoRow[]
  /** Cadastro de pessoas, pra escolher as testemunhas. */
  pessoas: PessoaTestemunha[]
  assinatura: Omit<AssinaturaAditivos, 'tipo'>
}) {
  return (
    <TermosAditivosSecao
      contratoId={contratoId}
      codigoContrato={codigoContrato}
      originarioPadrao={originarioPadrao}
      cidadeUf={cidadeUf}
      aditivos={aditivos}
      pessoas={pessoas}
      tipos={TIPOS}
      pdfBase="/api/contratos/aditivos"
      textoVazio="Nenhum aditivo. Use depois que o contrato já está assinado e algo precisa mudar — reajuste fora de época, prorrogação de prazo, troca de garantia ou inclusão de cláusula. Gera um PDF próprio que referencia o contrato e é assinado pelas partes (Lei 8.245/91)."
      subtitulo="Vincula ao contrato e gera um PDF assinável. As demais cláusulas do contrato permanecem inalteradas."
      placeholderTitulo="Ex: Prorrogação 2027"
      assinatura={{ ...assinatura, tipo: 'aditivo_locacao' }}
      criar={i => criarAditivo(comTipo(i))}
      atualizar={(id, i) => atualizarAditivo(id, comTipo(i))}
      excluir={excluirAditivo}
    />
  )
}
