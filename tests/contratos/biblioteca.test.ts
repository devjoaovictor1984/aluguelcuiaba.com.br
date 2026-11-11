// Biblioteca de cláusulas (v105): código, versão, lacunas e placeholders
// novos do contrato de administração. Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_CLAUSULAS } from '@/lib/contratos/seed-modelo'
import {
  MODELO_POR_CODIGO, codigoDoSeed, modeloDaLinha, slug, tituloDeReferencia, versaoBaseDaLinha, versaoDoSeed,
} from '@/lib/contratos/modelo'
import { diffPalavras } from '@/lib/contratos/diff'
import {
  aplicarPlaceholdersV2, listarPendencias, pendenciasQueTravam, type DadosContrato, type PendenciaPlaceholder,
} from '@/lib/contratos/montar'

const rodar = (corpo: string, dados: DadosContrato) => {
  const mapa = new Map<string, PendenciaPlaceholder>()
  const texto = aplicarPlaceholdersV2(corpo, dados, mapa)
  return { texto, pendencias: listarPendencias(mapa) }
}
const legivel = (t: string) => t.replace(/\uE000/g, '[').replace(/\uE001/g, ']')

const ADM: DadosContrato['administracao'] = {
  data_inicio: '2026-12-01', data_termino: '2027-11-30', prazo_meses: 12,
  taxa_tipo: 'percentual', taxa_valor: 10, dia_repasse: 5, aviso_previo_dias: 30, multa_rescisao_meses: 3,
  exclusividade: true, recebimento_comissao: 'mensal', primeira_parcela_cheia: true,
  taxa_base: 'aluguel', repasse_dias_uteis: 5, limite_reparos: 500,
}

test('todo código do modelo é único e estável', () => {
  const codigos = SEED_CLAUSULAS.map(codigoDoSeed)
  assert.equal(new Set(codigos).size, codigos.length)
  assert.equal(MODELO_POR_CODIGO.size, SEED_CLAUSULAS.length)
  assert.equal(slug('Pet — aceita (com autorização)'), 'pet-aceita-com-autorizacao')
})

test('modelo de administração v2 não tem mais lacuna entre colchetes', () => {
  const comLacuna = SEED_CLAUSULAS
    .filter(c => c.tipo === 'administracao' && /\[[^\]\n]+\]/.test(c.corpo))
    .map(c => c.titulo)
  assert.deepEqual(comLacuna, [])
  assert.ok(SEED_CLAUSULAS.some(c => c.tipo === 'administracao' && c.titulo === 'Da vacância'))
})

test('lacuna "[…]" escrita no texto vira pendência visível e trava a assinatura', () => {
  const { texto, pendencias } = rodar('O IMÓVEL inclui [QUANTIDADE] vaga(s).', {})
  assert.equal(legivel(texto), 'O IMÓVEL inclui [COMPLETAR NO TEXTO: QUANTIDADE] vaga(s).')
  assert.equal(pendencias[0].motivo, 'manual')
  assert.equal(pendencias[0].entidade, 'clausula')
  assert.equal(pendenciasQueTravam(pendencias).length, 1)
})

test('taxa: a base de cálculo sai explícita (só aluguel-base ou com encargos)', () => {
  const soAluguel = rodar('{{ADM_TAXA_BASE}}', { administracao: ADM }).texto
  assert.match(soAluguel, /exclusivamente sobre o aluguel-base.*excluídos condomínio, IPTU/)
  const comEncargos = rodar('{{ADM_TAXA_BASE}}', { administracao: { ...ADM, taxa_base: 'aluguel_encargos' } }).texto
  assert.match(comEncargos, /sobre o aluguel e sobre o condomínio e o IPTU/)
  const fixa = rodar('{{ADM_TAXA_BASE}}', { administracao: { ...ADM, taxa_tipo: 'fixo', taxa_valor: 200 } }).texto
  assert.match(fixa, /valor fixo mensal/)
})

test('comissão de intermediação segue a "primeira parcela cheia"', () => {
  assert.match(rodar('{{ADM_COMISSAO_INTERMEDIACAO}}', { administracao: ADM }).texto, /100% \(cem por cento\) do primeiro aluguel-base/)
  assert.match(rodar('{{ADM_COMISSAO_INTERMEDIACAO}}', { administracao: { ...ADM, primeira_parcela_cheia: false } }).texto, /não cobrada de forma destacada/)
})

test('prazo da administração: determinado e indeterminado por extenso', () => {
  assert.equal(rodar('{{ADM_PRAZO_DESCRICAO}}', { administracao: ADM }).texto,
    'pelo prazo de 12 (doze) meses, com início em 01/12/2026 e término em 30/11/2027')
  assert.equal(rodar('{{ADM_PRAZO_DESCRICAO}}', { administracao: { ...ADM, prazo_meses: null, data_termino: null } }).texto,
    'por prazo indeterminado, com início em 01/12/2026')
})

test('repasse e limite de reparo sem valor viram pendência — nada de número inventado', () => {
  const { texto, pendencias } = rodar('em até {{ADM_REPASSE_DIAS_UTEIS}} dias úteis; até {{ADM_LIMITE_REPAROS}} por evento',
    { administracao: { ...ADM, repasse_dias_uteis: null, limite_reparos: null } })
  assert.deepEqual(pendencias.map(p => p.chave).sort(), ['ADM_LIMITE_REPAROS', 'ADM_REPASSE_DIAS_UTEIS'])
  assert.doesNotMatch(texto, /\d/)
  // Intl põe espaço não separável entre "R$" e o número.
  assert.match(rodar('{{ADM_LIMITE_REPAROS}} ({{ADM_LIMITE_REPAROS_EXTENSO}})', { administracao: ADM }).texto,
    /^R\$\s500,00 \(quinhentos reais\)$/)
})

test('"Das partes" da administração v2: PJ com representante aparece uma vez só, e-mail pendente', () => {
  const partes = SEED_CLAUSULAS.find(c => c.tipo === 'administracao' && c.categoria === 'partes')!
  const { texto, pendencias } = rodar(partes.corpo, {
    locador: { nome: 'EMPRESA TESTE LTDA', cpf_cnpj: '11222333000181', telefone: '65999990000',
      endereco_logradouro: 'Rua A', endereco_numero: '1', endereco_cidade: 'Cuiabá', endereco_estado: 'MT' },
    admin: { razao_social: 'IMOBILIÁRIA TESTE LTDA', cnpj: '11222333000181', creci_juridico: '0-J', nome: 'CORRETOR', creci: '0-F',
      endereco_logradouro: 'Av. B', endereco_numero: '2', endereco_cidade: 'Cuiabá', endereco_uf: 'MT' },
    administracao: { ...ADM, proprietario_representante_nome: 'JOSÉ REPRESENTANTE', proprietario_representante_cpf: '52998224725' },
  })
  assert.equal(texto.split('JOSÉ REPRESENTANTE').length - 1, 1)
  assert.match(texto, /EMPRESA TESTE LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 11\.222\.333\/0001-81/)
  assert.match(legivel(texto), /endereço eletrônico \[PENDENTE: E-MAIL DO LOCADOR\] e telefone \(65\) 99999-0000/)
  assert.ok(pendencias.some(p => p.chave === 'LOCADOR_EMAIL'))
})

test('linha antiga da biblioteca se liga ao modelo pelo tipo + título', () => {
  const rem = SEED_CLAUSULAS.find(c => c.tipo === 'administracao' && c.categoria === 'remuneracao')!
  assert.equal(versaoDoSeed(rem), 2)
  const linhaAntiga = { tipo: 'administracao', titulo: 'Da remuneração', corpo: 'texto antigo, de antes da revisão' }
  const m = modeloDaLinha(linhaAntiga)
  assert.equal(m && codigoDoSeed(m), codigoDoSeed(rem))
  // Texto diferente do modelo atual → considerada v1 → há atualização a oferecer.
  assert.equal(versaoBaseDaLinha(linhaAntiga, rem), 1)
  // Texto igual ao atual (com espaços diferentes) → já está na v2.
  assert.equal(versaoBaseDaLinha({ corpo: `  ${rem.corpo.replace(/ /g, '  ')}  ` }, rem), 2)
  assert.equal(modeloDaLinha({ tipo: 'administracao', titulo: 'Cláusula que eu inventei' }), null)
})

test('cláusula renomeada continua sendo reconhecida pelo título original', () => {
  const pet = SEED_CLAUSULAS.find(c => c.tipo === 'pet' && /não aceita/i.test(c.titulo))!
  assert.equal(tituloDeReferencia({ codigo: codigoDoSeed(pet), titulo: 'Animais: vedado' }), pet.titulo)
  assert.equal(tituloDeReferencia({ codigo: null, titulo: 'Animais: vedado' }), 'Animais: vedado')
})

test('diferença palavra a palavra', () => {
  const d = diffPalavras('o aluguel será pago até o dia 5', 'o aluguel será pago até o dia 10')
  assert.deepEqual(d.filter(t => t.tipo !== 'igual'), [
    { tipo: 'removido', texto: '5' }, { tipo: 'incluido', texto: '10' },
  ])
  assert.equal(d.filter(t => t.tipo !== 'removido').map(t => t.texto).join(''), 'o aluguel será pago até o dia 10')
})
