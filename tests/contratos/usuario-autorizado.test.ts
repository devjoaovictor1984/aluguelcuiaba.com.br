// Usuário autorizado (papel ocupante_autorizado): quem assina, cláusulas,
// prazo da troca de titularidade e validações. Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moradoresQueAssinam, rotuloPapel } from '@/lib/crm/papel-morador'
import {
  rotuloUsuarioAutorizado, somarDiasUteis, statusTitularidade,
  verificarUsuarioAutorizado, verificacaoDosVinculos,
} from '@/lib/contratos/usuario-autorizado'
import { clausulaUsuarioAutorizado, clausulaTitularidade } from '@/lib/contratos/usuario-autorizado-clausulas'

const JONAS = {
  nome: 'JONAS DE TESTE', cpf_cnpj: '52998224725', nacionalidade: 'brasileiro', estado_civil: 'casado',
  profissao: 'advogado', genero: 'M', rg: '1234567', rg_orgao_emissor: 'SSP', rg_uf: 'MT',
}
const CTX = {
  finalidade: 'comercial' as const,
  locatario_nome: 'RUI DE TESTE',
  tem_administracao: true,
  prazo_titularidade_dias_uteis: 10,
  imovel: { uc_energia: '6/123456-7' },
}
const semQuebra = (s: string) => s.replace(/\s+/g, ' ')

// ── Cenário A — locação comercial com usuário autorizado ─────────────

test('A: usuário comercial assina como interveniente anuente, não como morador/locatário', () => {
  const r = moradoresQueAssinam(
    [{ papel: 'ocupante_autorizado', mora_no_imovel: false, assina_contrato: false, pessoa: { nome: 'JONAS DE TESTE' } }],
    { finalidade: 'comercial' },
  )
  assert.equal(r.length, 1)
  assert.equal(r[0].rotulo, 'Usuário comercial autorizado / Interveniente anuente')
  assert.doesNotMatch(r[0].rotulo, /morador|locatário/i)
})

test('A: cláusula de autorização traz art. 13, consentimento do locador e nega solidariedade', () => {
  const c = clausulaUsuarioAutorizado([{ pessoa: JONAS, atividade_no_imovel: 'escritório de advocacia' }], CTX)!
  assert.equal(c.titulo, 'Do usuário comercial autorizado')
  const t = semQuebra(c.corpo)
  assert.match(t, /JONAS DE TESTE, brasileiro, casado, advogado/)
  assert.match(t, /USUÁRIO COMERCIAL AUTORIZADO \/ INTERVENIENTE ANUENTE/)
  assert.match(t, /RUI DE TESTE, que permanece como único titular da relação locatícia/)
  assert.match(t, /art\. 13 da Lei nº 8\.245\/1991/)
  assert.match(t, /LOCADOR, ao firmar este instrumento, consente prévia e expressamente/)
  assert.match(t, /não torna o USUÁRIO COMERCIAL AUTORIZADO locatário, fiador ou devedor solidário/)
  assert.match(t, /responde pelos danos que ele próprio causar/)
  assert.match(t, /vigora enquanto durar a locação/)
  assert.match(t, /escritório de advocacia/)
  assert.doesNotMatch(t, /residência/)
})

test('A: Jonas titular da energia gera cláusula com prazo, UC e exigência de comprovante', () => {
  const c = clausulaTitularidade([{ pessoa: JONAS, consumos_titular: ['energia'] }], CTX)!
  const t = semQuebra(c.corpo)
  assert.match(t, /JONAS DE TESTE obriga-se a solicitar/)
  assert.match(t, /energia elétrica \(unidade consumidora nº 6\/123456-7\)/)
  assert.match(t, /10 \(dez\) dias úteis contados da efetiva entrega das chaves/)
  assert.match(t, /não bastando a assinatura deste instrumento/)
  assert.match(t, /à ADMINISTRADORA/)
})

// ── Cenário B — residencial tradicional ──────────────────────────────

test('B: morador que não mora não assina; residencial usa "Ocupante autorizado"', () => {
  const r = moradoresQueAssinam([
    { papel: 'morador', mora_no_imovel: false, pessoa: { nome: 'FILHO' } },
    { papel: 'morador', mora_no_imovel: true, assina_contrato: false, pessoa: { nome: 'FILHA' } },
    { papel: 'morador', mora_no_imovel: true, pessoa: { nome: 'ESPOSA' } },
  ])
  assert.deepEqual(r.map(x => [x.pessoa.nome, x.rotulo]), [['ESPOSA', 'Morador']])
  assert.equal(rotuloUsuarioAutorizado('residencial'), 'Ocupante autorizado')
  const c = clausulaUsuarioAutorizado([{ pessoa: JONAS }], { ...CTX, finalidade: 'residencial' })!
  assert.equal(c.titulo, 'Do ocupante autorizado')
  assert.match(c.corpo, /como residência/)
})

test('B: sem consumo marcado, nenhuma cláusula de titularidade', () => {
  assert.equal(clausulaTitularidade([{ pessoa: JONAS, consumos_titular: [] }], CTX), null)
})

// ── Cenário C — locação empresarial ──────────────────────────────────

test('C: PJ com sócio, representante e usuário autorizado — cada um com seu papel', () => {
  const r = moradoresQueAssinam([
    { papel: 'socio_signatario', mora_no_imovel: false, pessoa: { nome: 'SOCIO' } },
    { papel: 'interveniente_anuente', mora_no_imovel: false, pessoa: { nome: 'REPRESENTANTE' } },
    { papel: 'ocupante_autorizado', mora_no_imovel: true, pessoa: { nome: 'USUARIO' } },
  ], { finalidade: 'comercial' })
  assert.deepEqual(r.map(x => x.rotulo), [
    'Sócio signatário', 'Interveniente anuente', 'Usuário comercial autorizado / Interveniente anuente',
  ])
})

// ── Cenário D — transferência de energia ─────────────────────────────

test('D: prazo em dias úteis pula fim de semana', () => {
  // 2026-11-13 é sexta: 1 dia útil depois = segunda 16
  assert.equal(somarDiasUteis('2026-11-13', 1), '2026-11-16')
  assert.equal(somarDiasUteis('2026-11-16', 10), '2026-11-30')
})

test('D: status da titularidade segue chaves, prazo e comprovante', () => {
  const base = { consumos_titular: ['energia'], prazo_dias_uteis: 10 }
  assert.equal(statusTitularidade({ ...base }).status, 'aguardando_chaves')
  assert.deepEqual(
    statusTitularidade({ ...base, chaves_entregues_em: '2026-11-16', hoje: '2026-11-20' }),
    { status: 'no_prazo', prazo_ate: '2026-11-30' },
  )
  assert.equal(statusTitularidade({ ...base, chaves_entregues_em: '2026-11-16', hoje: '2026-12-01' }).status, 'atrasada')
  assert.equal(statusTitularidade({ ...base, chaves_entregues_em: '2026-11-16', titularidade_confirmada_em: '2026-11-25' }).status, 'confirmada')
  assert.equal(statusTitularidade({ consumos_titular: [] }).status, 'sem_obrigacao')
})

// ── Cenário E — contrato antigo ──────────────────────────────────────

test('E: contrato sem usuário autorizado não ganha validação nem cláusula nova', () => {
  const d = verificacaoDosVinculos(
    [{ papel: 'morador', mora_no_imovel: true, pessoa: { nome: 'ESPOSA', cpf_cnpj: '11144477735' } }],
    { finalidade: 'residencial', garantia_tipo: 'seguro_fianca', locatario_cpf_cnpj: '52998224725' },
  )
  assert.deepEqual(verificarUsuarioAutorizado(d), [])
  assert.equal(clausulaUsuarioAutorizado([], CTX), null)
  assert.equal(rotuloPapel('morador'), 'Morador')
})

// ── Validações ───────────────────────────────────────────────────────

test('validação: seguro fiança sem ciência da seguradora é alerta, não bloqueio', () => {
  const d = verificacaoDosVinculos(
    [{ papel: 'ocupante_autorizado', pessoa: { nome: 'JONAS', cpf_cnpj: '52998224725' }, atividade_no_imovel: 'advocacia' }],
    { finalidade: 'comercial', garantia_tipo: 'seguro_fianca', locatario_cpf_cnpj: '11144477735' },
  )
  const itens = verificarUsuarioAutorizado(d)
  assert.equal(itens.find(i => i.id === 'usuario_seguradora')?.severidade, 'warn')
  assert.ok(itens.every(i => i.severidade !== 'block'))
  const ok = verificarUsuarioAutorizado({ ...d, seguradora_ciente_usuario_em: '2026-11-12' })
  assert.equal(ok.find(i => i.id === 'usuario_seguradora')?.severidade, 'ok')
})

test('validação: sem CPF ou sendo o próprio locatário bloqueia; dois papéis alerta', () => {
  const semCpf = verificarUsuarioAutorizado(verificacaoDosVinculos(
    [{ papel: 'ocupante_autorizado', pessoa: { nome: 'SEM DOC', cpf_cnpj: null } }],
    { finalidade: 'comercial' },
  ))
  assert.equal(semCpf.find(i => i.id === 'usuario_doc')?.severidade, 'block')

  const proprio = verificarUsuarioAutorizado(verificacaoDosVinculos(
    [{ papel: 'ocupante_autorizado', pessoa: { nome: 'RUI', cpf_cnpj: '529.982.247-25' } }],
    { finalidade: 'comercial', locatario_cpf_cnpj: '52998224725' },
  ))
  assert.equal(proprio.find(i => i.id === 'usuario_e_locatario')?.severidade, 'block')

  const duplo = verificarUsuarioAutorizado(verificacaoDosVinculos([
    { papel: 'ocupante_autorizado', pessoa: { nome: 'JONAS', cpf_cnpj: '52998224725' } },
    { papel: 'morador', mora_no_imovel: true, pessoa: { nome: 'JONAS', cpf_cnpj: '52998224725' } },
  ], { finalidade: 'comercial' }))
  assert.ok(duplo.some(i => i.id.startsWith('usuario_duplicado_') && i.severidade === 'warn'))
})
