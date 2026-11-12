# Editor do documento do contrato de locação

Tela: `/painel/contratos/[id]/gerar`. Fase 1 do pedido de "editor completo"
(12/11/2026), feita sem migration. O que ficou para as próximas fases está em
`docs/pendencias.md` ("Editor completo do contrato").

## Onde cada parte do documento é montada

| Parte | Monta | Edita |
| --- | --- | --- |
| Capa | `montarResumoCapa` na rota do PDF | "Campos da capa" (`capa_overrides`) |
| Cláusulas do contrato | snapshot `contrato_geracoes.clausulas` | cards do editor |
| Cláusulas automáticas dos participantes | `src/lib/contratos/clausulas-automaticas.ts` | "Personalizar texto" no card |
| Tabela dos 12 meses (valores) | `montarTabela12Meses` (financeiro) | não edita: vem do contrato |
| Observação da tabela, declaração do inventário, termo de chaves | `src/lib/contratos/documento-textos.ts` | "Textos do documento" (`capa_overrides`) |
| Inventário (itens) | `contrato_inventario_itens` | tela do contrato |
| PDF | `src/app/api/contratos/[geracaoId]/pdf/route.ts` + `src/lib/crm/contrato-pdf.tsx` | — |

## Automático x personalizado

- **Cláusulas automáticas** (`usuario_autorizado`, `titularidade`) são geradas
  dos participantes a cada PDF e entram logo após "Das partes". No editor
  aparecem com borda tracejada e selo "automática", na posição e com o número
  que terão no PDF.
- **Personalizar** copia o texto para o snapshot com `origem`. A partir daí a
  automática daquela origem não é mais gerada: vale a cópia, que pode ser
  editada, reordenada e marcada como modificada como qualquer cláusula.
- **Restaurar automática** remove a cópia; o texto volta a ser gerado.
- Os **textos do documento** ficam em `capa_overrides` com chaves próprias
  (`CHAVES_DOCUMENTO`). Campo vazio = automático.

### Precedência dos textos

1. Texto personalizado da geração.
2. Padrão atual, se o contrato ainda não tem processo de assinatura.
3. Padrão legado, se já tem: a via final sai igual ao que os signatários
   leram. Para o layout legado o componente recebe `undefined` e usa o texto
   antigo; a fotografia em `tests/contratos/__fotos__` não muda.

Padrões atuais que mudaram em relação ao legado:

- **Tabela:** não fala mais em "reajustado anualmente"; remete às condições de
  valor, escalonamento e reajuste das cláusulas.
- **Inventário:** singular/plural pelo número de locatários e cita o usuário
  autorizado quando há.
- **Devolução das chaves:** o recebimento não depende de quitação nem de
  concordância com a vistoria; pendências são cobradas na forma do contrato.

### Termo de chaves

Editáveis: título, identificação do imóvel, texto de entrega (substitui os
parágrafos de entrega e posse; linha em branco separa parágrafos),
observações, texto de devolução e quem recebe. Quantidades continuam em
"Itens entregues". A data efetiva continua sendo `chaves_entregues_em`: sem
ela, e com início no futuro, o texto padrão fala no futuro.

"Só o usuário autorizado recebe" marca os demais recebedores com `ciencia`: o
locatário assina como "LOCATÁRIO (CIENTE DA ENTREGA)" e o usuário autorizado
como recebedor. A opção só aparece quando há usuário autorizado.

## Cláusula vazia

`corpoVazio()` considera vazio só o que não tem texto visível (`<p></p>`,
`<br>`, `&nbsp;`, invisíveis). Tabela, imagem e linha horizontal contam como
conteúdo. Cláusula vazia sai do PDF e do sumário e a numeração é refeita
(apenas para contrato sem processo de assinatura). O editor mostra "–" no
lugar do número e o checklist avisa.

## Duplicidade

`verificarDuplicidades()` só alerta, nunca remove:

- cláusula do contrato sobre o mesmo assunto de uma automática ativa (regex por
  origem em `ORIGENS_AUTOMATICAS`);
- duas cláusulas com o mesmo título (sem acento e caixa).

O operador escolhe: remover uma, editar, ou personalizar a automática e juntar
os textos nela.

## Segurança documental e auditoria

- Toda action de edição recusa contrato assinado (`contratoAssinado`); a
  `atualizarCapaOverrides` passou a recusar também.
- `atualizarCapaOverrides` mescla as chaves enviadas com as existentes, porque
  agora há dois editores no mesmo campo.
- Personalizar/restaurar automática e mudar textos gravam evento
  `contrato_atualizado` em `eventos_contrato`, com o texto anterior.

## Testes

`tests/contratos/documento-editavel.test.ts`: cláusula vazia, automáticas com
origem, duplicidade, singular/plural do inventário, devolução padrão,
precedência do texto personalizado e os textos chegando à árvore do PDF
(inclusive o locatário "ciente da entrega" sem virar "Locatário 2").
`tests/contratos/pdf-diagramacao.test.ts` garante o layout legado intacto.
