#!/usr/bin/env node
/**
 * Verifica se a Maximiza já liberou o cadastro da IMOBILIATTO às
 * seguradoras em homologação.
 *
 * Desde 30/08/2026 toda cotação sob o CNPJ da IMOBILIATTO volta 400
 * "Usuário e/ou Senha Inválidos!" — não é o nosso login (o /auth passa),
 * é o vínculo entre o cadastro deles e a credencial da seguradora. Este
 * script existe pra responder "já arrumaram?" sem abrir o painel e sem
 * refazer o formulário: manda o MESMO payload duas vezes, trocando só o
 * `cpfcnpj_imob`, e mostra os dois resultados lado a lado.
 *
 * Segurança: chama SÓ o `/calculo`, que não leva `criaRegistro` — não
 * cria análise, não emite apólice, não gera cobrança. Pode rodar à
 * vontade. `/contratar` e `/cancelar` nunca são tocados aqui.
 *
 * Uso:
 *   node scripts/testa-incendio-imobiliatto.mjs
 *   node scripts/testa-incendio-imobiliatto.mjs --cnpj=00000000000000
 *
 * Lê MAXIMIZA_EMAIL, MAXIMIZA_SENHA e MAXIMIZA_CNPJ_TESTE do .env.local.
 * O `ambiente` do corpo é fixo em "2": este script é de homologação e não
 * aceita rodar contra produção.
 */

import { readFileSync } from 'node:fs'

const URL_AUTH = 'https://auth.api.seguro.imb.br/auth'
const URL_CALCULO = 'https://incendio.api.seguro.imb.br/incendioAlfaV2/calculo'
const CNPJ_IMOBILIATTO = '45528182000106'
const TIMEOUT_MS = 55_000

/* ── env ───────────────────────────────────────────────────────────── */

function carregarEnv() {
  let texto
  try {
    texto = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    sair('Não achei o .env.local na raiz do projeto.')
  }
  const env = {}
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function sair(msg) {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

/* ── payload ───────────────────────────────────────────────────────── */

/**
 * O corpo da cotação que falhou em 30/08/2026, copiado do `seguro_eventos`.
 *
 * Fica congelado de propósito: o valor do teste está em ser o MESMO payload
 * de sempre, com uma única variável (o CNPJ). Mexer nos valores aqui
 * destrói a comparação com as medições já registradas no diário.
 *
 * A vigência vai com 12 meses, e não com os 30 do evento original — os 30
 * vinham do bug do formulário (ver `form-incendio.tsx:169`) e já foi medido
 * em 01/09 que não mudam o resultado. Aqui vale mais o payload limpo.
 */
const CORPO = {
  ambiente: '2',
  cpfcnpj_imob: null,          // preenchido por cotar()
  tipo_seguro: 'R',
  tipo_vigencia: 0,
  tipo_cobertura: 2,
  aluguel: 1800,
  rubricao_cupacao: '4070',
  cdresp2_cupacao: '1002',
  cdpacote_assist: 8,
  nome_inquilino: 'ANDRESSA SIMAO DA SILVA',
  cpf_inquilino: '138.707.247-14',
  tipo_inquilino: 'F',
  data_inquilino: '25/05/1993',
  ddd_inquilino: 21,
  fone_inquilino: '97993-1028',
  email_inquilino: 'andressassimao@hotmail.com',
  nome_proprietario: 'RIVÂNIA SILVA PASSOS COUTINHO',
  cpf_proprietario: '361.799.901-82',
  tipo_proprietario: 'F',
  endereco_seguro: 'R. A, 11 - Res. Paiaguás, Cuiabá - MT',
  numero_endereco_seguro: 103,
  complemento_endereco_seguro: 'Bloco 11 Condomínio Paiaguás',
  bairro_endereco_seguro: 'Paiaguás',
  cidade_endereco_seguro: 'Cuiabá',
  uf_endereco_seguro: 'MT',
  cep_endereco_seguro: '78048-258',
  inicio_vigencia_seguro: '01/09/2026',
  fim_vigencia_seguro: '01/09/2027',
  vl_cob_incendio: 144000,
  vl_cob_conteudo: 28800,
  vl_cob_vendaval: 36000,
  vl_cob_perda_aluguel: 10800,
  vl_cob_danos_eletrico: 7200,
  vl_cob_vazamento: 7200,
  vl_cob_resp_civil: 14400,
}

/* ── chamadas ──────────────────────────────────────────────────────── */

async function autenticar(env) {
  if (!env.MAXIMIZA_EMAIL || !env.MAXIMIZA_SENHA) {
    sair('MAXIMIZA_EMAIL / MAXIMIZA_SENHA não estão no .env.local.')
  }
  const resp = await fetch(URL_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.MAXIMIZA_EMAIL, password: env.MAXIMIZA_SENHA }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const { accessToken } = await resp.json().catch(() => ({}))
  console.log(`  /auth  →  HTTP ${resp.status}${accessToken ? '  (token recebido)' : ''}`)
  if (!accessToken) {
    sair('Sem accessToken. Aí sim o problema é a NOSSA credencial — confira MAXIMIZA_EMAIL/SENHA.')
  }
  return accessToken
}

async function cotar(token, rotulo, cnpj, seguradora) {
  const inicio = Date.now()
  let resp, dados
  try {
    resp = await fetch(URL_CALCULO, {
      method: 'POST',
      // Sem "Bearer" — a API rejeita o formato padrão.
      headers: { Authorization: token, 'Content-Type': 'application/json', seguradora },
      body: JSON.stringify({ ...CORPO, cpfcnpj_imob: cnpj }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const texto = await resp.text()
    try { dados = JSON.parse(texto) } catch { dados = texto }
  } catch (e) {
    console.log(`\n  ${rotulo}\n    FALHA DE REDE: ${e.message}`)
    return { ok: false }
  }

  const ms = Date.now() - inicio
  console.log(`\n  ${rotulo}\n    HTTP ${resp.status}  ·  ${ms}ms`)

  if (dados?.coberturas) {
    console.log(`    prêmio ${dados.premio}  ·  líquido ${dados.vlpreliq}  ·  IOF ${dados.vliof}  ·  ${dados.coberturas.length} coberturas`)
    return { ok: true }
  }
  console.log(`    ${dados?.message ?? JSON.stringify(dados)}`)
  return { ok: false, mensagem: String(dados?.message ?? '') }
}

/* ── main ──────────────────────────────────────────────────────────── */

const env = carregarEnv()
const arg = process.argv.find(a => a.startsWith('--cnpj='))
const cnpj = (arg ? arg.split('=')[1] : CNPJ_IMOBILIATTO).replace(/\D/g, '')
const cnpjTeste = env.MAXIMIZA_CNPJ_TESTE

console.log('\n  Cotação de incêndio em HOMOLOGAÇÃO — só /calculo, nada é emitido.\n')

const token = await autenticar(env)

const a = await cotar(token, `A) ${cnpj} (IMOBILIATTO)  ·  header Alfa`, cnpj, 'Alfa')
const b = await cotar(token, `B) ${cnpjTeste} (teste)  ·  header Alfa`, cnpjTeste, 'Alfa')
const c = await cotar(token, `C) ${cnpj} (IMOBILIATTO)  ·  header Porto`, cnpj, 'Porto')

console.log('\n  ─────────────────────────────────────────────────────────────\n')

if (a.ok && c.ok) {
  console.log('  LIBERADO. A cotação sai sob a IMOBILIATTO nas duas seguradoras.')
  console.log('  Próximo passo: tirar MAXIMIZA_FORCAR_CNPJ_TESTE do .env.local')
  console.log('  (local e Vercel) e rodar o roteiro de teste de incêndio.')
} else if (a.ok || c.ok) {
  console.log(`  PARCIAL. Alfa ${a.ok ? 'ok' : 'falhou'} · Porto ${c.ok ? 'ok' : 'falhou'}.`)
  console.log('  Liberaram uma seguradora só — vale avisar a corretora.')
} else if (!b.ok) {
  console.log('  INCONCLUSIVO. Nem o CNPJ de teste cotou, então o problema')
  console.log('  agora é outro: pode ser instabilidade do ambiente deles.')
} else if (/senha|usu[áa]rio/i.test(a.mensagem ?? '')) {
  console.log('  AINDA BLOQUEADO — mesmo erro de credencial de 30/08.')
  console.log('  O CNPJ de teste cota normalmente, então o ambiente está de pé:')
  console.log('  falta vincular as credenciais das seguradoras ao cadastro da')
  console.log('  IMOBILIATTO. É provisionamento na corretora; não há nada a')
  console.log('  fazer do nosso lado.')
} else {
  console.log('  MUDOU. O erro sob a IMOBILIATTO não é mais o de credencial —')
  console.log('  leia a mensagem acima: agora pode ser payload, e aí é conosco.')
}
console.log('')
