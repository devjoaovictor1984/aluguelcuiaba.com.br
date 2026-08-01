#!/usr/bin/env node
/**
 * Seed de demonstração do módulo de seguros.
 *
 * Popula análises de fiança realistas pra gravar vídeo ou apresentar a
 * plataforma antes da integração estar ligada. NÃO é um "modo demo" no
 * app: escreve direto no banco, então nenhuma linha de código de produção
 * muda por causa disso.
 *
 * Segurança:
 *  · tudo entra com `ambiente = 2` (homologação) — a interface já mostra
 *    o selo "teste" nesses registros, então ninguém confunde com apólice
 *    real;
 *  · todo registro leva o marcador `_seed` no payload/observações, e o
 *    --limpar só apaga o que tem o marcador. Dado real de homologação
 *    nunca é tocado.
 *
 * Uso:
 *   node scripts/seed-seguros.mjs --email=voce@dominio.com
 *   node scripts/seed-seguros.mjs --email=voce@dominio.com --limpar
 *
 * Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MARCADOR = '_seed_demo_seguros'

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
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

/* ── CPF fictício com dígito verificador válido ────────────────────── */

/**
 * Completa 9 dígitos com os 2 verificadores. As bases são padrões óbvios
 * (111444777, 222555888…) pra deixar claro que é dado de teste, mas o
 * cálculo é o real — assim a máscara e as validações da tela funcionam.
 */
function cpfFicticio(base9) {
  const d = base9.split('').map(Number)
  for (let rodada = 0; rodada < 2; rodada++) {
    const peso = d.length + 1
    const soma = d.reduce((acc, n, i) => acc + n * (peso - i), 0)
    const resto = soma % 11
    d.push(resto < 2 ? 0 : 11 - resto)
  }
  return d.join('')
}

const fmtCpf = c => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

/* ── Dados da demonstração ─────────────────────────────────────────── */

const diasAtras = n => new Date(Date.now() - n * 86400000).toISOString()

/**
 * Seis cenários que contam a história inteira numa tela só:
 * o caminho feliz, a aprovação parcial, a espera por biometria, a recusa
 * com saída, a análise em curso e o preenchimento pelo próprio inquilino.
 */
const CENARIOS = [
  {
    nome: 'ANA PAULA SOUZA MARTINS',
    cpfBase: '111444777',
    email: 'ana.martins@exemplo.com.br',
    celular: '(65) 99811-4477',
    aluguel: 1800,
    condominio: 320,
    iptu: 95,
    origem: 'painel',
    diasAtras: 1,
    resumo: 'aprovado',
    // Caminho feliz: as quatro responderam, três aprovaram.
    pareceres: [
      { sigla: 'porto', nome: 'Porto Seguro', status: 1, limite: 1800 },
      { sigla: 'too',   nome: 'Too Seguros',  status: 1, limite: 1800 },
      { sigla: 'tok',   nome: 'Tokio Marine', status: 1, limite: 1800 },
      { sigla: 'ptc',   nome: 'Pottencial',   status: 3, msg: 'Restrição cadastral.' },
    ],
    arquivos: ['carta', 'cotacao'],
  },
  {
    nome: 'CARLOS EDUARDO PEREIRA LIMA',
    cpfBase: '222555888',
    email: 'carlos.lima@exemplo.com.br',
    celular: '(65) 99622-5588',
    aluguel: 2500,
    condominio: 480,
    iptu: 140,
    origem: 'painel',
    diasAtras: 2,
    resumo: 'aprovado',
    // Aprovação PARCIAL: dá pra fechar renegociando o aluguel.
    pareceres: [
      { sigla: 'porto', nome: 'Porto Seguro', status: 5, limite: 2100, msg: 'Aprovado com limite inferior ao solicitado.' },
      { sigla: 'too',   nome: 'Too Seguros',  status: 3, msg: 'Renda insuficiente para o valor pretendido.' },
      { sigla: 'tok',   nome: 'Tokio Marine', status: 3 },
      { sigla: 'ptc',   nome: 'Pottencial',   status: 5, limite: 2000 },
    ],
    arquivos: ['carta'],
  },
  {
    nome: 'JULIANA FERREIRA DOS SANTOS',
    cpfBase: '333666999',
    email: 'juliana.santos@exemplo.com.br',
    celular: '(65) 99733-6699',
    aluguel: 1450,
    condominio: 0,
    iptu: 70,
    origem: 'link',
    diasAtras: 0,
    resumo: 'analisando',
    // Pré-aprovada: falta o inquilino fazer a biometria.
    pareceres: [
      {
        sigla: 'porto', nome: 'Porto Seguro', status: 12,
        msg: 'Pre-Aprovado. Necessaria Biometria para aprovacao completa',
        biometria: 0,
        linkBiometria: 'https://antifraude.exemplo.com.br/biometria/demo-0001',
      },
      { sigla: 'too', nome: 'Too Seguros',  status: 2 },
      { sigla: 'tok', nome: 'Tokio Marine', status: 2 },
      { sigla: 'ptc', nome: 'Pottencial',   status: 1, limite: 1450 },
    ],
    arquivos: [],
  },
  {
    nome: 'MARCOS ANTONIO RIBEIRO',
    cpfBase: '444777222',
    email: 'marcos.ribeiro@exemplo.com.br',
    celular: '(65) 99844-7722',
    aluguel: 3200,
    condominio: 610,
    iptu: 210,
    origem: 'painel',
    diasAtras: 5,
    resumo: 'recusado',
    // Recusa geral — a tela oferece reanálise.
    pareceres: [
      { sigla: 'porto', nome: 'Porto Seguro', status: 3, msg: 'Pendência financeira em consulta a bureau.' },
      { sigla: 'too',   nome: 'Too Seguros',  status: 3 },
      { sigla: 'tok',   nome: 'Tokio Marine', status: 3 },
      { sigla: 'ptc',   nome: 'Pottencial',   status: 3 },
    ],
    arquivos: ['carta'],
  },
  {
    nome: 'PATRICIA GOMES DE ALMEIDA',
    cpfBase: '555888333',
    email: 'patricia.almeida@exemplo.com.br',
    celular: '(65) 99655-8833',
    aluguel: 2100,
    condominio: 400,
    iptu: 118,
    origem: 'link',
    diasAtras: 0,
    resumo: 'analisando',
    // Acabou de chegar pelo link — ainda sem parecer definitivo.
    pareceres: [
      { sigla: 'porto', nome: 'Porto Seguro', status: 2 },
      { sigla: 'too',   nome: 'Too Seguros',  status: 2 },
      { sigla: 'tok',   nome: 'Tokio Marine', status: 2 },
      { sigla: 'ptc',   nome: 'Pottencial',   status: 2 },
    ],
    arquivos: [],
  },
  {
    nome: 'RENATO CARVALHO NOGUEIRA',
    cpfBase: '666999444',
    email: 'renato.nogueira@exemplo.com.br',
    celular: '(65) 99866-9944',
    aluguel: 1250,
    condominio: 0,
    iptu: 58,
    origem: 'painel',
    diasAtras: 9,
    resumo: 'aprovado',
    // Ciclo completo: aprovado, contratado e apólice emitida.
    contratado: true,
    pareceres: [
      { sigla: 'porto', nome: 'Porto Seguro', status: 1, limite: 1250 },
      { sigla: 'too',   nome: 'Too Seguros',  status: 1, limite: 1250 },
      { sigla: 'tok',   nome: 'Tokio Marine', status: 8, msg: 'Aguardando emissão da apólice.' },
      { sigla: 'ptc',   nome: 'Pottencial',   status: 1, limite: 1250 },
    ],
    arquivos: ['carta', 'cotacao', 'apolice'],
  },
]

const TIPO_ARQUIVO = { carta: 2, cotacao: 3, apolice: 9 }
const DESC_ARQUIVO = { carta: 'Carta Parecer', cotacao: 'Cotação', apolice: 'Apólice' }

/**
 * Preço de referência no formato que consultarPrecosApi devolve: planos
 * agrupados por forma de pagamento. Só os planos que a tela resume.
 */
function precosDemo(aluguel) {
  const premio = Math.round(aluguel * 7.8 * 100) / 100   // ~7,8 aluguéis
  const parcela29 = Math.round((premio / 29) * 100) / 100
  const parcela12 = Math.round((premio / 12) * 1.09 * 100) / 100
  const opcao = (forma, plano, parcelas, valor, entrada = 0) => ({
    entrada_pagto: entrada,
    forma_pagto_descricao: forma,
    tipo_plano: plano,
    qtd_parcelas: parcelas,
    valor_parcela: valor,
  })
  return {
    plano_tradicional: {
      fatura: [opcao('Fatura', 'traditional', 29, parcela29)],
      boleto: [opcao('Boleto', 'traditional', 1, premio, 1)],
      ficha:  [opcao('Ficha', 'traditional', 29, parcela29)],
      cartao: [opcao('Cartão de Crédito', 'traditional', 12, parcela12)],
    },
    plano_completo: {
      fatura: [opcao('Fatura', 'complete', 29, Math.round(parcela29 * 1.22 * 100) / 100)],
      boleto: [opcao('Boleto', 'complete', 1, Math.round(premio * 1.22 * 100) / 100, 1)],
    },
  }
}

/* ── Execução ──────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2)
  const email = args.find(a => a.startsWith('--email='))?.split('=')[1]
  const limpar = args.includes('--limpar')

  if (!email) {
    sair('Informe o e-mail da conta: node scripts/seed-seguros.mjs --email=voce@dominio.com')
  }

  const env = carregarEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) sair('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.')

  const db = createClient(url, key, { auth: { persistSession: false } })

  // Acha o dono pelo e-mail.
  const { data: lista, error: eUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (eUsers) sair(`Falha ao listar usuários: ${eUsers.message}`)
  const user = lista.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) sair(`Nenhuma conta com o e-mail ${email}.`)

  console.log(`\n→ conta: ${email}  (${user.id})`)

  if (limpar) {
    await limparSeed(db, user.id)
    return
  }

  await semear(db, user.id)
}

async function limparSeed(db, userId) {
  // Só o que tem o marcador. Dado real de homologação fica intacto.
  const { data: analises } = await db
    .from('seguro_analises')
    .select('id')
    .eq('user_id', userId)
    .contains('payload', { [MARCADOR]: true })

  const ids = (analises ?? []).map(a => a.id)

  if (ids.length) {
    // Pareceres e arquivos caem por ON DELETE CASCADE.
    await db.from('seguro_analises').delete().in('id', ids)
  }

  const { data: links } = await db
    .from('seguro_analise_links')
    .select('id')
    .eq('user_id', userId)
    .like('titulo', `%${MARCADOR}%`)

  if (links?.length) {
    await db.from('seguro_analise_links').delete().in('id', links.map(l => l.id))
  }

  const { data: pessoas } = await db
    .from('pessoas')
    .select('id')
    .eq('user_id', userId)
    .like('observacoes', `%${MARCADOR}%`)

  if (pessoas?.length) {
    await db.from('pessoas').delete().in('id', pessoas.map(p => p.id))
  }

  console.log(`\n✓ removidos: ${ids.length} análise(s), ${links?.length ?? 0} link(s), ${pessoas?.length ?? 0} pessoa(s)\n`)
}

async function semear(db, userId) {
  // Vincula a imóveis reais da conta, se houver — a listagem fica bem mais
  // apresentável com título de imóvel do que com traço.
  // (imoveis não tem soft delete; o filtro fica por status.)
  const { data: imoveis, error: eImoveis } = await db
    .from('imoveis')
    .select('id, titulo')
    .eq('user_id', userId)
    .limit(10)

  if (eImoveis) console.log(`  ! imóveis: ${eImoveis.message}`)
  const temImovel = (imoveis ?? []).length > 0
  if (!temImovel) {
    console.log('  (nenhum imóvel na conta — as análises ficam sem imóvel vinculado)')
  }

  // maximiza_id é único por (produto, ambiente) no banco inteiro, não por
  // usuário. Base aleatória por execução pra poder semear várias contas.
  const baseId = 900000 + Math.floor(Math.random() * 90000)

  let n = 0
  for (const [i, c] of CENARIOS.entries()) {
    const cpf = cpfFicticio(c.cpfBase)
    const imovelId = temImovel ? imoveis[i % imoveis.length].id : null

    // 1. Pretenso inquilino
    const { data: pessoa, error: ePessoa } = await db
      .from('pessoas')
      .insert({
        user_id: userId,
        tipo: 'inquilino',
        nome: c.nome,
        cpf_cnpj: cpf,
        email: c.email,
        telefone: c.celular,
        whatsapp: c.celular,
        observacoes: `Dado fictício de demonstração — ${MARCADOR}`,
      })
      .select('id')
      .single()

    if (ePessoa) {
      console.error(`  ✗ ${c.nome}: ${ePessoa.message}`)
      continue
    }

    // 2. Análise
    const { data: analise, error: eAnalise } = await db
      .from('seguro_analises')
      .insert({
        user_id: userId,
        produto: 'fianca',
        origem: c.origem,
        imovel_id: imovelId,
        inquilino_id: pessoa.id,
        // Homologação: a interface marca esses registros com o selo "teste".
        ambiente: 2,
        maximiza_id: baseId + i,
        tipo_analise: 'reduzida',
        finalidade: 'R',
        valor_aluguel: c.aluguel,
        status_resumo: c.resumo,
        consentimento_em: diasAtras(c.diasAtras),
        consentimento_ip: '203.0.113.10',
        created_at: diasAtras(c.diasAtras),
        payload: {
          [MARCADOR]: true,
          pretendente: { nome: c.nome, cpfCnpj: fmtCpf(cpf), email: c.email, celular: c.celular },
          imovel: {
            aluguel: c.aluguel, condominio: c.condominio, iptu: c.iptu,
            finalidade: 'R', periodoContratoMeses: 30,
          },
        },
      })
      .select('id')
      .single()

    if (eAnalise) {
      // Desfaz a pessoa: sem a análise ela vira lixo na carteira.
      await db.from('pessoas').delete().eq('id', pessoa.id)
      console.error(`  ✗ ${c.nome}: ${eAnalise.message}`)
      continue
    }

    // 3. Pareceres — um por seguradora. Quem aprovou já vem com preço,
    //    que é como a tela mostra: parecer e valor lado a lado.
    const pareceres = c.pareceres.map(p => {
      const aprovou = p.status === 1 || p.status === 5
      return {
        analise_id: analise.id,
        seguradora_sigla: p.sigla,
        seguradora_nome: p.nome,
        codigo_status: p.status,
        descricao_status: null,
        codigo_analise: String(909000000000 + Math.floor(Math.random() * 999999999)),
        limite_aprovado: p.limite ?? null,
        status_biometria: p.biometria ?? null,
        link_biometria: p.linkBiometria ?? null,
        msg: p.msg ?? null,
        precos: aprovou ? precosDemo(p.limite ?? c.aluguel) : null,
        precos_em: aprovou ? diasAtras(Math.max(0, c.diasAtras - 0.1)) : null,
        atualizado_em: diasAtras(Math.max(0, c.diasAtras - 0.2)),
      }
    })

    const { error: ePar } = await db.from('seguro_analise_pareceres').insert(pareceres)
    if (ePar) console.error(`  ! pareceres de ${c.nome}: ${ePar.message}`)

    // 4. Metadados de documento. Não subimos PDF: o storage_path aponta
    //    pra um caminho inexistente e a tela mostra o item desabilitado,
    //    o que é honesto — não há documento real nenhum aqui.
    for (const tipo of c.arquivos) {
      await db.from('seguro_arquivos').insert({
        analise_id: analise.id,
        user_id: userId,
        seguradora_sigla: c.pareceres[0].sigla,
        codigo_tipo: TIPO_ARQUIVO[tipo],
        descricao: DESC_ARQUIVO[tipo],
        storage_path: `${userId}/${analise.id}/demo-${tipo}.pdf`,
        tamanho_bytes: 128000,
        recebido_em: diasAtras(Math.max(0, c.diasAtras - 0.3)),
      })
    }

    // 5. Contratação — o cenário do seguro já emitido, pra mostrar o card
    //    de "Seguro contratado" com proposta e apólice.
    if (c.contratado) {
      const seg = c.pareceres.find(p => p.status === 1) ?? c.pareceres[0]
      const p = precosDemo(seg.limite ?? c.aluguel)
      const opcao = p.plano_tradicional.fatura[0]
      const inicio = new Date(Date.now() - c.diasAtras * 86400000)
      const fim = new Date(inicio); fim.setMonth(fim.getMonth() + 30)

      await db.from('seguro_contratacoes').insert({
        analise_id: analise.id,
        user_id: userId,
        seguradora_sigla: seg.sigla,
        tipo_plano: opcao.tipo_plano,
        forma_pagto: opcao.forma_pagto_descricao,
        qtd_parcelas: opcao.qtd_parcelas,
        valor_parcela: opcao.valor_parcela,
        premio_total: Math.round(opcao.qtd_parcelas * opcao.valor_parcela * 100) / 100,
        entrada_pagto: 0,
        inicio_vigencia: inicio.toISOString().slice(0, 10),
        fim_vigencia: fim.toISOString().slice(0, 10),
        coberturas: { condominio: c.condominio, iptu: c.iptu },
        proprietario: { tipo: 'F', nome: 'Proprietário de demonstração' },
        status: 'emitida',
        proposta_numero: '003890',
        apolice_numero: '1074600192411',
        emitida_em: diasAtras(Math.max(0, c.diasAtras - 1)),
      })
    }

    n++
    console.log(`  ✓ ${c.nome} — ${c.resumo}${c.contratado ? ' (contratado)' : ''}`)
  }

  // 5. Um link pendente, pra mostrar o fluxo de envio ao inquilino.
  const token = 'demo' + Math.random().toString(36).slice(2, 22)
  const { error: eLink } = await db.from('seguro_analise_links').insert({
    user_id: userId,
    produto: 'fianca',
    token,
    imovel_id: temImovel ? imoveis[0].id : null,
    tipo_analise: 'reduzida',
    titulo: `Análise de seguro fiança — ${MARCADOR}`,
    mensagem: 'Preencha seus dados pra darmos andamento na locação.',
    dados_imovel: {
      cep: '78000-000', aluguel: 1650, condominio: 280, iptu: 88,
      finalidade: 'R', periodoContratoMeses: 30, pinturaNova: true,
    },
    expira_em: new Date(Date.now() + 6 * 86400000).toISOString(),
    aberto_em: diasAtras(0.5),
  })
  if (eLink) console.error(`  ! link: ${eLink.message}`)

  const base = 'http://localhost:3000'
  console.log(`\n✓ ${n} análise(s) + 1 link criados, todos marcados como TESTE (ambiente 2).`)
  console.log(`\n  painel:  ${base}/painel/seguros/fianca`)
  console.log(`  links:   ${base}/painel/seguros/fianca/links`)
  console.log(`  público: ${base}/seguro-fianca/${token}`)
  console.log(`\n  pra remover:  node scripts/seed-seguros.mjs --email=... --limpar\n`)
}

main().catch(e => sair(e?.message ?? String(e)))
