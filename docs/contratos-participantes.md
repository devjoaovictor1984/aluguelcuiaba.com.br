# Participantes do contrato de locação

Quem entra num contrato além do locador e do locatário principal, o que cada
papel faz nos documentos e onde está a regra no código. Atualizado em
12/11/2026 (migration v106).

## Papéis

Tabela `contratos_moradores`, coluna `papel`. O papel diz a **posição
jurídica** da pessoa. As responsabilidades extras ficam em colunas à parte, e
só para o usuário autorizado (ver abaixo).

| papel | aparece como | assina | recebe chaves |
| --- | --- | --- | --- |
| `inquilino_solidario` | Co-locatário solidário | sim | se mora |
| `morador` | Morador | se mora e `assina_contrato` | se mora |
| `socio_signatario` | Sócio signatário | sim | não |
| `responsavel_seguro` | Responsável pelo seguro fiança | sim | não |
| `conjuge_responsavel_seguro` | Cônjuge do responsável pelo seguro | sim | não |
| `ocupante_autorizado` | **Usuário comercial autorizado** (comercial) / **Ocupante autorizado** (residencial e misto), sempre "/ Interveniente anuente" | **sempre** | **sempre** |
| `caucionante` | Caucionante | sim | não |
| `interveniente_anuente` | Interveniente anuente | sim | não |

O rótulo sai de `rotuloPapel(papel, finalidade)` em `src/lib/crm/papel-morador.ts`,
e quem assina sai de `moradoresQueAssinam()` no mesmo arquivo. As duas
funções servem às mesmas telas e documentos: capa, bloco de assinatura do
contrato e do aditivo, e sugestão de signatários da assinatura eletrônica.

## Usuário autorizado

Quem usa o imóvel sem ser locatário. Caso que motivou: o seguro fiança está no
nome do sogro (locatário), e o genro, advogado, usa a sala como escritório.

**Regra principal:** o usuário autorizado assina como interveniente anuente e
recebe as chaves, mas **não vira** locatário, fiador nem devedor solidário. O
papel nunca muda o locatário principal.

Colunas (v106):

| onde | coluna | para quê |
| --- | --- | --- |
| `contratos_moradores` | `consumos_titular` | contas que ele **é obrigado** a pôr no nome (`energia`, `agua`, `gas`, `internet`). Vazio = só autorizado a pedir |
| `contratos_moradores` | `atividade_no_imovel` | ex.: "escritório de advocacia, OAB/MT nº …"; entra na cláusula |
| `contratos_moradores` | `titularidade_confirmada_em` / `titularidade_comprovante_id` | a troca só conta como feita com o comprovante |
| `contratos_locacao` | `prazo_titularidade_dias_uteis` | prazo da troca após a entrega das chaves (padrão 10) |
| `contratos_locacao` | `seguradora_ciente_usuario_em` / `_obs` / `_comprovante_id` | registro de que a seguradora soube do uso por terceiro |

O `assina_contrato = false` antigo do ocupante autorizado é ignorado. Era só o
default da regra velha, quando esse papel não assinava.

### Cláusulas geradas

Ficam em `src/lib/contratos/usuario-autorizado-clausulas.ts` e entram no PDF
logo após "Das partes" (`src/app/api/contratos/[geracaoId]/pdf/route.ts`,
bloco 6b2). Seguem o padrão da cláusula do responsável pelo seguro: são
montadas na hora e **não ficam na biblioteca**, então nunca alteram uma
cláusula que o operador editou. Desde a fase 1 do editor aparecem no editor e
podem ser personalizadas por contrato (`src/lib/contratos/clausulas-automaticas.ts`,
ver `docs/contratos-editor.md`).

1. **Do usuário comercial autorizado / Do ocupante autorizado.** Traz a
   qualificação, a atividade e o locatário que continua titular. Inclui:
   - o consentimento prévio e expresso do locador (art. 13 da Lei 8.245/1991);
   - o que o usuário pode fazer: acesso, chaves, cadastro no condomínio,
     pedir titularidade das contas;
   - que ele não é locatário, fiador nem solidário, e que a autorização não
     define por si só a natureza jurídica da relação;
   - que responde pelos danos que ele mesmo causar;
   - que a autorização vale enquanto durar a locação.
2. **Da transferência de titularidade das contas de consumo.** Só sai quando
   há conta marcada. Dá o prazo em dias úteis a partir da entrega das chaves,
   a UC ou matrícula do cadastro do imóvel, a exigência de comprovante, a
   responsabilidade pelas faturas, o aviso de impedimento e o encerramento no
   fim. A concessionária não é fixada: o texto diz "concessionária
   competente".

### Termo de entrega de chaves

- Cada recebedor sai com o próprio papel: o usuário autorizado não aparece
  como "Locatário 2". Um parágrafo diz que ele recebe por autorização do
  locatário e do locador.
- Quando a data de início ainda não chegou e não há `chaves_entregues_em`, o
  termo fala no futuro ("entregará", "receberá") e diz que a assinatura
  antecipada não comprova a entrega. Se a entrega já foi registrada, vale a
  data registrada.

### Validações (checklist pré-PDF)

`verificarUsuarioAutorizado()` em `src/lib/contratos/usuario-autorizado.ts`,
somada ao `rodarChecklist()` na rota do PDF e na do checklist. Só produz itens
quando o contrato tem usuário autorizado, então contrato antigo não ganha
nada.

| situação | nível |
| --- | --- |
| usuário sem CPF/CNPJ válido | bloqueia |
| usuário é o próprio locatário | bloqueia |
| mesma pessoa em outro papel no contrato | alerta |
| contrato comercial sem atividade informada | alerta |
| seguro fiança sem ciência da seguradora registrada | alerta |

### Tela

`src/app/(auth)/painel/contratos/[id]/_components/moradores-secao.tsx`:

- **Modal de adicionar:** mostra o nome certo do papel e, para o usuário
  autorizado, as contas e a atividade.
- **Linha da pessoa:** mostra os selos (assina, recebe chaves, titular de…) e
  o status da troca: aguardando chaves, no prazo, atrasada ou comprovada.
- **"Responsabilidades":** edita contas, atividade e prazo, e exige marcar a
  confirmação.
- **"Comprovar troca de titularidade":** pede data e arquivo.
- **Seguro fiança:** um aviso âmbar com "Registrar ciência".

As ações estão em `actions-usuario-autorizado.ts`. Toda mudança grava um
evento `contrato_atualizado` em `eventos_contrato`, que é o histórico. Os
comprovantes vão para o bucket `contratos-docs` e a tabela
`contratos_documentos`, com tipo `outro`.

## Compatibilidade

- A v106 só adiciona colunas com default neutro: arrays vazios e datas nulas.
  Nenhum contrato existente ganhou obrigação.
- O layout legado do PDF continua idêntico, conferido pela fotografia em
  `tests/contratos/__fotos__/contrato-legado.txt`.
- Contrato já assinado não muda: o PDF final assinado é guardado à parte. Um
  PDF gerado de novo depois desta versão mostra os rótulos novos.

## Testes

`tests/contratos/usuario-autorizado.test.ts` cobre:

- **A:** Rui é locatário e Jonas, usuário comercial, com energia no nome.
- **B:** contrato residencial com morador.
- **C:** locatário PJ com sócio, representante e usuário autorizado.
- **D:** prazo em dias úteis e status da troca.
- **E:** contrato antigo sem usuário autorizado.

Também cobre as validações. Para rodar: `npm test`.
