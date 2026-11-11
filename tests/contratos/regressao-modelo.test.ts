// Regressão: com cadastro completo, o motor v2 tem que produzir o MESMO
// texto do motor legado em todas as cláusulas do modelo. Diferença só pode
// existir onde falta dado — e aí é o [PENDENTE] no lugar do vazio.
// Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aplicarPlaceholders, aplicarPlaceholdersV2, type DadosContrato, type PendenciaPlaceholder } from '@/lib/contratos/montar'
import { SEED_CLAUSULAS } from '@/lib/contratos/seed-modelo'

const endereco = {
  endereco_logradouro: 'Rua das Acácias', endereco_numero: '100', endereco_complemento: 'casa 2',
  endereco_bairro: 'Centro', endereco_cidade: 'Cuiabá', endereco_estado: 'MT', endereco_cep: '78000000',
}

const COMPLETO: DadosContrato = {
  locador: {
    nome: 'MARIA DE TESTE', cpf_cnpj: '52998224725', rg: '1234567', rg_orgao_emissor: 'SSP', rg_uf: 'MT',
    nacionalidade: 'brasileira', estado_civil: 'casada', profissao: 'professora', genero: 'F',
    email: 'maria@exemplo.test', telefone: '65999990000', ...endereco,
  },
  locatario: {
    nome: 'JOÃO DE TESTE', cpf_cnpj: '11144477735', rg: '7654321', rg_orgao_emissor: 'SESP', rg_uf: 'MT',
    nacionalidade: 'brasileiro', estado_civil: 'casado', regime_bens: 'comunhão parcial de bens',
    profissao: 'engenheiro', genero: 'M', data_nascimento: '1990-05-10', naturalidade: 'Várzea Grande-MT',
    nome_pai: 'PAI DE TESTE', nome_mae: 'MÃE DE TESTE', email: 'joao@exemplo.test', telefone: '65988880000',
    ...endereco,
    conjuge_nome: 'ANA DE TESTE', conjuge_cpf: '39053344705', conjuge_genero: 'F', conjuge_rg: '999 SSP/MT',
    conjuge_data_nascimento: '1991-02-03', conjuge_profissao: 'médica', conjuge_nacionalidade: 'brasileira',
    conjuge_naturalidade: 'Cuiabá-MT', conjuge_nome_pai: 'PAI ANA', conjuge_nome_mae: 'MÃE ANA',
    conjuge_endereco_logradouro: 'Rua B', conjuge_endereco_numero: '5', conjuge_endereco_bairro: 'Bosque',
    conjuge_endereco_cidade: 'Cuiabá', conjuge_endereco_estado: 'MT', conjuge_endereco_cep: '78000001',
  },
  fiador: {
    nome: 'FIADOR DE TESTE', cpf_cnpj: '86288366757', rg: '555 SSP/MT', genero: 'M',
    endereco_logradouro: 'Rua C', endereco_numero: '9', endereco_cidade: 'Cuiabá', endereco_estado: 'MT',
  },
  admin: {
    nome: 'CORRETOR DE TESTE', razao_social: 'IMOBILIÁRIA TESTE LTDA', cnpj: '11222333000181',
    creci: '00000-F', creci_juridico: '00000-J', endereco_logradouro: 'Av. Teste', endereco_numero: '1',
    endereco_bairro: 'Centro', endereco_cidade: 'Cuiabá', endereco_uf: 'MT', endereco_cep: '78000002',
  },
  imovel: {
    tipo: 'casa', endereco_completo: 'Rua do Imóvel', endereco_numero: '50', endereco_complemento: 'fundos',
    endereco_bairro: 'Goiabeiras', endereco_cep: '78032160', matricula_cartorio: '12345',
    inscricao_municipal: '01.02.03', uc_energia: '999', matricula_agua: 'A-1', uc_gas: 'G-1',
    area_construida_m2: 120, area_terreno_m2: 250, descricao_real: 'Casa térrea com 3 quartos.',
    cartorio_registro: '1º Ofício', livro_folha_matricula: 'Livro 2, fl. 3',
    hidrometro_numero: 'H-1', hidrometro_leitura_inicial: '0001', medidor_energia_numero: 'M-1',
    medidor_energia_leitura_inicial: '0002',
  },
  contrato: {
    codigo: '2026CT999', valor_aluguel: 2000, iptu_mensal: 150, condominio_mensal: 300,
    data_inicio: '2026-12-01', data_termino: null, duracao_meses: 30, dia_vencimento: 10,
    caucao_valor: 6000, seguro_fianca_seguradora: 'Seguradora Teste', seguro_fianca_contratacao: '123',
    seguro_fianca_apolice: '456', valor_seguro_fianca_mensal: 120, valor_seguro_incendio_anual: 240,
    aluguel_inclui_iptu: true, aluguel_inclui_condominio: true, aluguel_inclui_agua: true,
    aluguel_inclui_energia: false, aluguel_inclui_gas: false, aluguel_inclui_internet: false,
    tipo_seguro_incendio: 'cobrado_parte',
  },
  administracao: {
    codigo: 'ADM2026-999', data_inicio: '2026-12-01', data_termino: '2027-11-30', prazo_meses: 12,
    taxa_tipo: 'percentual', taxa_valor: 10, dia_repasse: 5, aviso_previo_dias: 30, multa_rescisao_meses: 3,
    exclusividade: true, recebimento_comissao: 'mensal', primeira_parcela_cheia: true,
    taxa_base: 'aluguel', repasse_dias_uteis: 5, limite_reparos: 500,
    proprietario_representante_nome: null, proprietario_representante_cpf: null, proprietario_representante_qualificacao: null,
  },
}

// Placeholders que, por natureza, resolvem vazio mesmo com tudo preenchido
// (texto livre que o corretor escreve depois / regra de mercado).
const VAZIOS_POR_DESENHO = /\{\{(OUTROS_ENCARGOS_FIXOS|SEGURO_INCENDIO_VALOR|ADM_PROPRIETARIO_REPRESENTANTE)\}\}/

// O v2 marca de propósito a lacuna "[…]" escrita no texto (o legado deixa
// o colchete cru). A comparação desfaz o marcador antes de comparar.
const comoLegado = (t: string) => t.replace(/\uE000COMPLETAR NO TEXTO: ([^\uE001]*)\uE001/g, '[$1]')

test(`modelo: ${SEED_CLAUSULAS.length} cláusulas idênticas nos dois motores`, () => {
  const diferentes: string[] = []
  for (const c of SEED_CLAUSULAS) {
    const pend = new Map<string, PendenciaPlaceholder>()
    const legado = aplicarPlaceholders(c.corpo, COMPLETO)
    const v2 = comoLegado(aplicarPlaceholdersV2(c.corpo, COMPLETO, pend))
    if (legado !== v2) diferentes.push(`${c.titulo}\n  legado: ${legado.slice(0, 160)}\n  v2:     ${v2.slice(0, 160)}`)
    // Lacuna escrita no texto é pendência por desenho (cláusula adicional a completar).
    const travam = [...pend.values()].filter(p => p.nivel !== 'opcional' && p.motivo !== 'manual')
    if (travam.length > 0 && !VAZIOS_POR_DESENHO.test(c.corpo)) {
      diferentes.push(`${c.titulo}: pendência com cadastro completo → ${travam.map(p => p.chave).join(', ')}`)
    }
  }
  assert.deepEqual(diferentes, [])
})
