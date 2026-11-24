import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ratearAcordo, resumirAcordo, type ParcelaParaAcordo } from '../../src/lib/crm/acordo.ts'

const parcela = (numero: number, extra: Partial<ParcelaParaAcordo> = {}): ParcelaParaAcordo => ({
  id: `p${numero}`, numero, valor_aluguel: 3600, valor_seguro: 0, valor_iptu: 0, valor_condominio: 0,
  valor_total: 3600, valor_comissao: 360, ...extra,
})

test('2 × R$ 3.600 quitadas por R$ 3.600: metade em cada, comissão sobre o que entrou', () => {
  const l = ratearAcordo([parcela(12), parcela(11)], 3600)
  assert.deepEqual(l.map(x => [x.numero, x.valor_pago, x.desconto, x.valor_comissao, x.valor_repasse_proprietario]), [
    [11, 1800, 1800, 180, 1620],
    [12, 1800, 1800, 180, 1620],
  ])
  assert.deepEqual(resumirAcordo(l), { original: 7200, pago: 3600, desconto: 3600, comissao: 360, repasse: 3240 })
})

test('centavos que não dividem exato vão para a última', () => {
  const l = ratearAcordo([parcela(1), parcela(2), parcela(3)], 1000)
  assert.deepEqual(l.map(x => x.valor_pago), [333.33, 333.33, 333.34])
  assert.equal(resumirAcordo(l).pago, 1000)
})

test('proporcional ao valor de cada parcela', () => {
  const l = ratearAcordo([parcela(1, { valor_aluguel: 1000, valor_total: 1000, valor_comissao: 100 }), parcela(2)], 2300)
  assert.deepEqual(l.map(x => x.valor_pago), [500, 1800])
})

test('encargos são cobertos primeiro; desconto sai do aluguel', () => {
  const p = parcela(1, { valor_aluguel: 2000, valor_seguro: 100, valor_iptu: 150, valor_condominio: 250, valor_total: 2500, valor_comissao: 200 })
  const [x] = ratearAcordo([p], 1500)
  // 1500 − seguro 100 − iptu 150 − cond 250 = 1000 de aluguel → comissão 10% = 100
  assert.equal(x.valor_comissao, 100)
  assert.equal(x.valor_repasse_proprietario, 1000 + 150 + 250 - 100)
  assert.equal(x.desconto, 1000)
})

test('base aluguel + encargos escala pela base inteira', () => {
  const p = parcela(1, { valor_aluguel: 2000, valor_iptu: 200, valor_total: 2200, valor_comissao: 220 })
  const [x] = ratearAcordo([p], 1200, 'aluguel_encargos')
  assert.equal(x.valor_comissao, 120)
  assert.equal(x.valor_repasse_proprietario, 1200 - 120)
})

test('valor acordado igual ao total: nada muda', () => {
  const [x] = ratearAcordo([parcela(1)], 3600)
  assert.deepEqual([x.valor_pago, x.desconto, x.valor_comissao, x.valor_repasse_proprietario], [3600, 0, 360, 3240])
})
