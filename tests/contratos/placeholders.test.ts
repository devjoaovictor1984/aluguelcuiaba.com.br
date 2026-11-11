// Testes do motor de placeholders (src/lib/contratos/montar.ts).
// Dados fictícios — nenhum cadastro real.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarPlaceholders, aplicarPlaceholdersV2, listarPendencias, motorDoContrato,
  pendenciasQueTravam, MOTOR_V2_DESDE, type DadosContrato, type PendenciaPlaceholder,
} from '@/lib/contratos/montar'

const PF_COMPLETA = {
  id: 'p1', nome: 'MARIA DE TESTE', cpf_cnpj: '52998224725', rg: '1234567', rg_orgao_emissor: 'SSP', rg_uf: 'MT',
  nacionalidade: 'brasileira', estado_civil: 'casado', profissao: 'professora', genero: 'F',
  email: 'maria@exemplo.test', telefone: '65999990000',
  endereco_logradouro: 'Rua das Acácias', endereco_numero: '100', endereco_bairro: 'Centro',
  endereco_cidade: 'Cuiabá', endereco_estado: 'MT', endereco_cep: '78000000',
}

function rodar(corpo: string, dados: DadosContrato) {
  const mapa = new Map<string, PendenciaPlaceholder>()
  const texto = aplicarPlaceholdersV2(corpo, dados, mapa)
  return { texto, pendencias: listarPendencias(mapa) }
}

const semMarcas = (t: string) => t.replace(//g, '[').replace(//g, ']')

test('PF completa: qualificação sai inteira, flexionada e sem pendência', () => {
  const { texto, pendencias } = rodar('{{LOCADOR_QUALIFICACAO}}.', { locador: PF_COMPLETA })
  assert.equal(pendencias.length, 0)
  assert.equal(texto,
    'MARIA DE TESTE, brasileira, casada, professora, portadora do RG nº 1234567 SSP/MT, inscrita no CPF sob o nº 529.982.247-25, residente e domiciliada em Rua das Acácias, nº 100, Centro, Cuiabá-MT, CEP 78000-000.')
})

test('e-mail em branco vira [PENDENTE: E-MAIL DO LOCATÁRIO], nunca some', () => {
  const { texto, pendencias } = rodar('Notificações para {{LOCATARIO_EMAIL}}.', {
    locatario: { ...PF_COMPLETA, email: null },
  })
  assert.equal(semMarcas(texto), 'Notificações para [PENDENTE: E-MAIL DO LOCATÁRIO].')
  assert.equal(pendencias[0].chave, 'LOCATARIO_EMAIL')
  assert.equal(pendencias[0].motivo, 'vazio')
})

test('CPF ausente é obrigatório e trava a assinatura', () => {
  const { pendencias } = rodar('CPF nº {{LOCATARIO_CPF}}', { locatario: { ...PF_COMPLETA, cpf_cnpj: null } })
  assert.equal(pendencias.length, 1)
  assert.equal(pendencias[0].nivel, 'obrigatorio')
  assert.equal(pendenciasQueTravam(pendencias).length, 1)
})

test('CPF com dígitos faltando é "invalido", não "vazio"', () => {
  const { pendencias } = rodar('CPF nº {{LOCADOR_CPF}}', { locador: { ...PF_COMPLETA, cpf_cnpj: '123.456' } })
  assert.equal(pendencias[0].motivo, 'invalido')
})

test('fiador não ligado ao contrato é "sem_vinculo"', () => {
  const { texto, pendencias } = rodar('Fiador: {{FIADOR_NOME}}.', { fiador: null })
  assert.match(semMarcas(texto), /\[PENDENTE: NOME DO FIADOR\]/)
  assert.equal(pendencias[0].motivo, 'sem_vinculo')
  assert.equal(pendencias[0].entidade, 'fiador')
})

test('placeholder escrito errado aparece como não reconhecido', () => {
  const { texto, pendencias } = rodar('Olá {{LOCADOR_NOMEE}} e {{ locador.nome }}.', { locador: PF_COMPLETA })
  assert.equal(pendencias.length, 2)
  assert.ok(pendencias.every(p => p.motivo === 'desconhecido' && p.entidade === 'clausula'))
  assert.doesNotMatch(texto, /\{\{/)
})

test('PJ com representante: CNPJ da empresa, CPF só junto do representante', () => {
  const { texto, pendencias } = rodar('{{LOCADOR_QUALIFICACAO}}.', {
    locador: { ...PF_COMPLETA, nome: 'EMPRESA TESTE LTDA', cpf_cnpj: '11222333000181' },
    administracao: {
      proprietario_representante_nome: 'JOSÉ REPRESENTANTE',
      proprietario_representante_cpf: '52998224725',
      proprietario_representante_qualificacao: 'sócio administrador',
    },
  })
  assert.equal(pendencias.length, 0)
  assert.match(texto, /^EMPRESA TESTE LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 11\.222\.333\/0001-81/)
  assert.match(texto, /representada por JOSÉ REPRESENTANTE, inscrito\(a\) no CPF sob o nº 529\.982\.247-25, na qualidade de sócio administrador/)
  // PJ não recebe RG, estado civil nem "residente e domiciliada"
  assert.doesNotMatch(texto, /RG|casada|domiciliada/)
})

test('legado preserva o texto de sempre; v2 não inventa prazo nem repasse', () => {
  const dados: DadosContrato = { contrato: { duracao_meses: null }, administracao: { dia_repasse: null } }
  // Legado: igual ao que já saía (prazo "30", repasse dia "5").
  assert.equal(aplicarPlaceholders('{{PRAZO_MESES}} meses, repasse dia {{ADM_DIA_REPASSE}}', dados), '30 meses, repasse dia 5')
  // v2: os dois viram pendência.
  const { texto, pendencias } = rodar('{{PRAZO_MESES}} meses, repasse dia {{ADM_DIA_REPASSE}}', dados)
  assert.doesNotMatch(texto, /\b30\b|\b5\b/)
  assert.deepEqual(pendencias.map(p => p.chave).sort(), ['ADM_DIA_REPASSE', 'PRAZO_MESES'])
})

test('opcional ausente sai do texto mas fica listado como omitido', () => {
  const { texto, pendencias } = rodar('Leitura inicial do hidrômetro: {{IMOVEL_HIDROMETRO_LEITURA}}.', {
    imovel: { endereco_completo: 'Rua X' },
  })
  assert.equal(texto, 'Leitura inicial do hidrômetro.')
  assert.equal(pendencias[0].nivel, 'opcional')
  assert.equal(pendenciasQueTravam(pendencias).length, 0)
})

test('qualificação incompleta: pendência no lugar, sem vírgula solta', () => {
  const { texto, pendencias } = rodar('{{LOCATARIO_QUALIFICACAO}}', {
    locatario: { ...PF_COMPLETA, profissao: null, rg: null },
  })
  const t = semMarcas(texto)
  assert.match(t, /casada, \[PENDENTE: PROFISSÃO DO LOCATÁRIO\], portadora do RG nº \[PENDENTE: RG DO LOCATÁRIO\], inscrita/)
  assert.doesNotMatch(t, /, ,|,,/)
  assert.equal(pendencias.length, 2)
})

test('acentuação e símbolos atravessam o motor intactos', () => {
  const corpo = 'ação, locação, administração, cláusula, imóvel, caução, órgão, 1ª, 2º, §, R$, nº, ç ã õ é ê í ó ú — {{LOCADOR_NOME}}'
  const { texto } = rodar(corpo, { locador: { ...PF_COMPLETA, nome: 'JOÃO TESTE' } })
  assert.equal(texto, corpo.replace('{{LOCADOR_NOME}}', 'JOÃO TESTE'))
})

test('ocorrências repetidas viram uma pendência só, com contagem', () => {
  const { pendencias } = rodar('{{LOCATARIO_EMAIL}} / {{LOCATARIO_EMAIL}}', { locatario: { ...PF_COMPLETA, email: '' } })
  assert.equal(pendencias.length, 1)
  assert.equal(pendencias[0].ocorrencias, 2)
})

test('motor: processo aberto antes do corte fica no legado', () => {
  assert.equal(motorDoContrato(null), 'v2')
  assert.equal(motorDoContrato('2026-01-01T00:00:00Z'), 'legado')
  assert.equal(motorDoContrato(new Date(Date.parse(MOTOR_V2_DESDE) + 1000).toISOString()), 'v2')
})
