import 'server-only'
import { dataPtBr, separarDdd } from '../maximiza/mapper'
import type {
  BoletoParcela, CalculoIncendioInput, ContratacaoIncendioInput,
  DocumentosProposta, Faturamento, ItemFatura, Ocupacao, PacoteAssistencia,
  ResultadoCalculo, ResultadoContratacao,
} from './tipos'

/**
 * Tradução entre o domínio e a API de incêndio.
 *
 * Convenções diferentes das de fiança, ainda que na mesma corretora:
 *  · valores vão como number (a fiança usa string PT-BR na análise);
 *  · alguns campos numéricos voltam como STRING ("120000.00", "100.01");
 *  · `ambiente` vai como STRING em toda chamada de incêndio.
 *
 * Tudo isso fica preso aqui.
 */

/**
 * Campos comuns a cálculo e contratação — a contratação só acrescenta.
 *
 * O endereço mora aqui, e não só na contratação, porque a Porto o exige já
 * no cálculo: sem ele responde 400 "endereco_seguro não informado". A Alfa
 * calcula sem, mas mandar nas duas não custa nada e evita a divergência.
 */
function corpoBase(i: CalculoIncendioInput, ambiente: 1 | 2): Record<string, unknown> {
  const foneInq = separarDdd(i.inquilino.telefone)

  return {
    /**
     * String, não número.
     *
     * Medido em 16/08/2026: a Alfa responde 400 "ambiente inválido" para
     * `2` e aceita `"2"`. A Porto não valida o campo em nenhum dos dois
     * formatos. Era o que derrubava toda cotação de incêndio na Alfa.
     *
     * Atenção: omitir o campo também passa na Alfa — e aí não sabemos em
     * que ambiente ela processa. Por isso vai sempre, explícito.
     */
    ambiente: String(ambiente),
    cpfcnpj_imob: i.cnpjImobiliaria,
    aluguel: i.aluguel,

    // O nome do campo tem essa grafia na API mesmo ("rubricao", "cupacao").
    rubricao_cupacao: i.ocupacao.rubrica,
    cdresp2_cupacao: i.ocupacao.cdresp2,
    cdpacote_assist: i.pacoteAssistencia,

    tipo_cobertura: i.tipoCobertura,
    tipo_vigencia: i.tipoVigencia,
    tipo_seguro: i.tipoSeguro,

    tipo_inquilino: i.inquilino.tipo,
    cpf_inquilino: i.inquilino.cpfCnpj,
    nome_inquilino: i.inquilino.nome,
    email_inquilino: i.inquilino.email ?? '',
    data_inquilino: dataPtBr(i.inquilino.dataNascimento) ?? '',
    ddd_inquilino: Number(foneInq.ddd) || undefined,
    fone_inquilino: foneInq.numero,

    nome_proprietario: i.proprietario.nome,
    cpf_proprietario: i.proprietario.cpfCnpj,
    tipo_proprietario: i.proprietario.tipo,
    ...(i.proprietarioSegurado != null ? { proprietario_segurado: i.proprietarioSegurado } : {}),

    uf_endereco_seguro: i.endereco.uf,
    cep_endereco_seguro: i.endereco.cep,
    endereco_seguro: i.endereco.endereco ?? '',
    numero_endereco_seguro: Number(String(i.endereco.numero ?? '').replace(/\D/g, '')) || 0,
    // Nome inferido do padrão dos vizinhos — ver EnderecoSeguro em tipos.ts.
    ...(i.endereco.complemento
      ? { complemento_endereco_seguro: i.endereco.complemento }
      : {}),
    bairro_endereco_seguro: i.endereco.bairro ?? '',
    cidade_endereco_seguro: i.endereco.cidade ?? '',
    inicio_vigencia_seguro: dataPtBr(i.inicioVigencia),
    fim_vigencia_seguro: dataPtBr(i.fimVigencia),

    vl_cob_incendio: i.valores.incendio ?? 0,
    vl_cob_perda_aluguel: i.valores.perdaAluguel ?? 0,
    vl_cob_vendaval: i.valores.vendaval ?? 0,
    vl_cob_resp_civil: i.valores.respCivil ?? 0,
    vl_cob_danos_eletrico: i.valores.danosEletricos ?? 0,
    vl_cob_vazamento: i.valores.vazamento ?? 0,
    // Sempre presente: a Porto exige o campo mesmo em "somente prédio", e
    // trata ausente e zero do mesmo jeito ("vl_cob_conteudo não
    // informado"). Quem barra o zero antes do envio é o formulário, com
    // mensagem que diz o que fazer.
    vl_cob_conteudo: i.valores.conteudo ?? 0,
    ...(i.valores.impactoVeiculo ? { vl_cob_impacto_veiculo: i.valores.impactoVeiculo } : {}),
  }
}

export function montarCalculo(i: CalculoIncendioInput, ambiente: 1 | 2): Record<string, unknown> {
  return corpoBase(i, ambiente)
}

/**
 * A contratação exige o que o cálculo dispensa: sexo do inquilino e
 * quantidade de parcelas. O endereço já vai no corpo base.
 */
export function montarContratacaoIncendio(
  i: ContratacaoIncendioInput,
  ambiente: 1 | 2,
): Record<string, unknown> {
  return {
    ...corpoBase(i, ambiente),
    sexo_inquilino: i.inquilino.sexo ?? 'M',
    qtpar: Math.max(1, Math.min(6, i.qtdParcelas)),
    ...(i.formaPagtoCodigo ? { cod_forma_pagto: i.formaPagtoCodigo } : {}),
    ...(i.formaPagtoDescricao ? { desc_forma_pagto: i.formaPagtoDescricao } : {}),
  }
}

/* ── Leitura ───────────────────────────────────────────────────────── */

/** Vários numéricos voltam como string ("120000.00"). */
function num(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Nomes das seguradoras de incêndio, nas DUAS formas que a API já devolveu.
 *
 * Medido em 16/08/2026:  ["Alfa", "Porto"]
 * Medido em 30/08/2026:  [{"seguradora":"Alfa","sigla":"al2"},
 *                         {"seguradora":"Porto","sigla":"por"}]
 *
 * Mudou sem aviso, sem versão nova de endpoint e sem alterar o status HTTP.
 * Como o mapper fazia `String(s)`, cada objeto virou a string
 * "[object Object]": a tela ofereceu duas seguradoras com esse nome e o
 * valor escolhido ia parar no header `seguradora` das chamadas seguintes.
 *
 * Continua devolvendo só o nome porque é o nome que o resto do fluxo usa —
 * header, coluna `seguradora` e catálogos. A `sigla` nova (`al2`/`por`)
 * ficou perguntada: não se sabe se o header passa a esperar ela.
 *
 * Forma desconhecida vira string vazia e é filtrada, então uma terceira
 * mudança de formato devolve lista vazia (a tela diz que está carregando)
 * em vez de encher o header de lixo.
 */
export function lerSeguradorasIncendio(bruto: unknown): string[] {
  return (Array.isArray(bruto) ? bruto : [])
    .map(s => {
      if (typeof s === 'string') return s.trim()
      const o = (s ?? {}) as Record<string, unknown>
      return String(o.seguradora ?? o.nome ?? '').trim()
    })
    .filter(Boolean)
}

export function lerOcupacoes(bruto: unknown): Ocupacao[] {
  return (Array.isArray(bruto) ? bruto : [])
    .map((o: Record<string, unknown>) => ({
      nome: String(o.nome ?? '').trim(),
      rubrica: String(o.rubrica ?? ''),
      cdresp2: String(o.cdresp2 ?? ''),
    }))
    .filter(o => o.nome && o.rubrica)
}

export function lerPacotes(bruto: unknown): PacoteAssistencia[] {
  return (Array.isArray(bruto) ? bruto : [])
    .map((p: Record<string, unknown>) => ({
      codigo: Number(p.codigo ?? 0),
      tipo: String(p.tipo ?? '').trim(),
      descricao: String(p.descricao ?? '').trim(),
    }))
    .filter(p => p.codigo > 0)
}

export function lerCalculo(bruto: unknown): ResultadoCalculo {
  const o = (bruto ?? {}) as Record<string, unknown>

  const coberturas = (Array.isArray(o.coberturas) ? o.coberturas : [])
    .map((c: Record<string, unknown>) => ({
      codigo: String(c.cdcob ?? ''),
      nome: String(c.nmcobert ?? '').trim(),
      limite: num(c.lmi),
      premio: num(c.premio),
      franquia: c.txtfranq ? String(c.txtfranq).trim() : null,
    }))
    .filter(c => c.nome)

  const formasPagamento = (Array.isArray(o.listaFormasPagto) ? o.listaFormasPagto : [])
    .map((f: Record<string, unknown>) => ({
      codigo: String(f.codigo ?? ''),
      parcelas: (Array.isArray(f.listaParcela) ? f.listaParcela : [])
        .map((p: Record<string, unknown>) => ({
          descricao: String(p.descricao ?? '').trim(),
          qtdParcelas: Number(p.qtdParcelas ?? 1),
          valorParcela: num(p.valorParcela),
        }))
        .filter(p => p.valorParcela > 0),
    }))
    .filter(f => f.parcelas.length > 0)

  return {
    coberturas,
    formasPagamento,
    premio: num(o.premio),
    valorAssistencia: num(o.vlassist),
    premioLiquido: num(o.vlpreliq),
    iof: num(o.vliof),
  }
}

export function lerContratacaoIncendio(bruto: unknown): ResultadoContratacao {
  const o = (bruto ?? {}) as Record<string, unknown>
  return {
    codigoSeguro: String(o.codigo_seguro ?? ''),
    numeroProposta: String(o.numero_proposta ?? ''),
  }
}

export function lerDocumentos(bruto: unknown): DocumentosProposta {
  const o = (bruto ?? {}) as Record<string, unknown>
  return {
    certificadoBase64: o.base64Certificado ? String(o.base64Certificado) : null,
    propostaBase64: o.base64Proposta ? String(o.base64Proposta) : null,
    numeroProposta: o.nrProposta ? String(o.nrProposta) : null,
  }
}

export function lerBoletos(bruto: unknown): BoletoParcela[] {
  return (Array.isArray(bruto) ? bruto : [])
    .map((b: Record<string, unknown>) => ({
      base64: String(b.base64 ?? ''),
      numParcela: Number(b.numParcela ?? 1),
      dataVencimento: b.dataVencimento ? String(b.dataVencimento) : null,
      dataPagamento: b.dataPagamento ? String(b.dataPagamento) : null,
    }))
    .filter(b => b.base64)
}

function lerItens(bruto: unknown): ItemFatura[] {
  return (Array.isArray(bruto) ? bruto : []).map((i: Record<string, unknown>) => ({
    codigo: String(i.codigo ?? ''),
    cnpjImobiliaria: String(i.CGC_imob ?? ''),
    cdconseg: i.cdconseg != null ? String(i.cdconseg) : null,
    cdemi: i.cdemi != null ? String(i.cdemi) : null,
    numeroProposta: i.numProposta != null ? String(i.numProposta) : null,
    dataCobertura: i.data_cob ? String(i.data_cob) : null,
    inquilino: i.inquilino ? String(i.inquilino) : null,
    proprietario: i.proprietario ? String(i.proprietario) : null,
    localRisco: i.localRisco ? String(i.localRisco) : null,
    parcelas: i.parcelas != null ? Number(i.parcelas) : null,
    valorParcela: i.valorParcela != null ? num(i.valorParcela) : null,
    premioTotal: i.premio_total != null ? num(i.premio_total) : null,
  }))
}

/**
 * Achata a resposta de faturamento, que vem aninhada em
 * vigência → ramo → { lista, base64 }.
 */
export function lerFaturamento(bruto: unknown): Faturamento[] {
  const raiz = (bruto ?? {}) as Record<string, unknown>
  const saida: Faturamento[] = []

  for (const vigencia of ['mensalizado', 'anual'] as const) {
    const porRamo = raiz[vigencia] as Record<string, unknown> | undefined
    if (!porRamo) continue

    for (const ramo of ['residencial', 'comercial'] as const) {
      const detalhe = porRamo[ramo] as Record<string, unknown> | undefined
      if (!detalhe) continue

      const itens = lerItens(detalhe.lista)
      if (!itens.length && !detalhe.base64) continue

      saida.push({
        vigencia,
        ramo,
        itens,
        base64: detalhe.base64 ? String(detalhe.base64) : null,
      })
    }
  }

  return saida
}
