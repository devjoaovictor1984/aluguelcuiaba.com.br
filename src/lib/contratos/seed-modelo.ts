/**
 * Seed das cláusulas baseado no contrato modelo IMOBILIATTO (caução em dinheiro).
 * Usado pelo botão "Importar contrato modelo" na tela de gestão de cláusulas.
 *
 * O usuário pode editar livremente depois de importar.
 */

import type { TipoClausula } from './placeholders'

export interface ClausulaSeed {
  tipo: TipoClausula
  categoria: string
  titulo: string
  numero: number
  corpo: string
}

export const SEED_CLAUSULAS: ClausulaSeed[] = [
  // ─────────── 1. DAS PARTES ───────────
  {
    tipo: 'generica', categoria: 'partes', titulo: 'Das partes', numero: 1,
    corpo: `LOCADORA / PROPRIETÁRIA: {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, portador(a) do CPF nº {{LOCADOR_CPF}}, residente e domiciliado(a) em {{LOCADOR_ENDERECO}}, doravante denominada simplesmente LOCADORA, neste ato representada, para fins de administração, cobrança, recebimento, entrega de chaves, vistoria e demais atos locatícios, pela ADMINISTRADORA abaixo qualificada.

ADMINISTRADORA: {{ADMIN_RAZAO_SOCIAL}}, pessoa jurídica de direito privado, inscrita no CNPJ nº {{ADMIN_CNPJ}}, CRECI Jurídico {{ADMIN_CRECI_J}}, com sede em {{ADMIN_ENDERECO}}, neste ato representada por {{ADMIN_RESPONSAVEL}}, corretor de imóveis, CRECI {{ADMIN_RESPONSAVEL_CRECI}}, doravante denominada simplesmente ADMINISTRADORA.

LOCATÁRIO: {{LOCATARIO_NOME}}, {{LOCATARIO_NACIONALIDADE}}, {{LOCATARIO_ESTADO_CIVIL}}, nascido(a) em {{LOCATARIO_DATA_NASC}}, natural de {{LOCATARIO_NATURALIDADE}}, portador(a) do RG {{LOCATARIO_RG}}, CPF nº {{LOCATARIO_CPF}}, filho(a) de {{LOCATARIO_NOME_PAI}} e {{LOCATARIO_NOME_MAE}}, residente e domiciliado(a) em {{LOCATARIO_ENDERECO}}, doravante denominado(a) LOCATÁRIO.

As partes ajustam o presente CONTRATO DE LOCAÇÃO RESIDENCIAL COM ADMINISTRAÇÃO IMOBILIÁRIA, regido pela Lei nº 8.245/1991, pelo Código Civil, pelo Código de Processo Civil e pelas cláusulas seguintes.`,
  },

  // ─────────── 2. OBJETO ───────────
  {
    tipo: 'generica', categoria: 'objeto', titulo: 'Do objeto da locação', numero: 2,
    corpo: `O presente contrato tem por objeto a locação residencial do imóvel situado em {{IMOVEL_ENDERECO}}, CEP {{IMOVEL_CEP}}, doravante denominado simplesmente IMÓVEL.

Parágrafo primeiro. O IMÓVEL é locado para finalidade exclusivamente residencial, sendo vedado seu uso para atividade comercial, industrial, hospedagem por diária, locação por temporada, Airbnb, sublocação, cessão, comodato, repasse de posse ou uso por terceiros sem autorização prévia e expressa da LOCADORA e da ADMINISTRADORA.

Parágrafo segundo. A LOCADORA declara ser legítima proprietária, possuidora ou titular apta a dar o IMÓVEL em locação, respondendo por vícios, defeitos e obrigações anteriores à entrega das chaves, nos limites da legislação aplicável.`,
  },

  // ─────────── 3. PRAZO ───────────
  {
    tipo: 'generica', categoria: 'prazo', titulo: 'Do prazo, início da locação e entrega das chaves', numero: 3,
    corpo: `O prazo da locação é de {{PRAZO_MESES}} ({{PRAZO_EXTENSO}}) meses, com início em {{DATA_INICIO}} e término em {{DATA_FIM}}.

Parágrafo primeiro. Este instrumento serve também como TERMO DE ENTREGA DE CHAVES, declarando o LOCATÁRIO que, nesta data, recebe a posse direta do IMÓVEL para moradia, ficando responsável por sua guarda, conservação, pagamento dos encargos e devolução nas condições contratadas.

Parágrafo segundo. Findo o prazo contratual, caso o LOCATÁRIO permaneça no IMÓVEL por mais de 30 (trinta) dias sem oposição da LOCADORA ou da ADMINISTRADORA, a locação poderá prorrogar-se por prazo indeterminado, mantidas as cláusulas compatíveis.`,
  },

  // ─────────── 4. ALUGUEL ───────────
  {
    tipo: 'generica', categoria: 'aluguel', titulo: 'Do valor do aluguel, IPTU, encargos e forma de pagamento', numero: 4,
    corpo: `O aluguel mensal ajustado é de {{ALUGUEL_VALOR}} ({{ALUGUEL_EXTENSO}}), com vencimento todo dia {{VENCIMENTO_DIA}} de cada mês.

Parágrafo primeiro. Além do aluguel, o LOCATÁRIO pagará mensalmente {{IPTU_VALOR}} a título de IPTU proporcional, totalizando {{TOTAL_MENSAL}} mensais.

Parágrafo segundo. São de responsabilidade exclusiva do LOCATÁRIO os consumos individualizados e serviços ligados ao uso do IMÓVEL: água, energia elétrica, gás, internet, telefonia, TV por assinatura, taxas de religação, multas por corte, segunda via, mudança de titularidade e demais cobranças.

Parágrafo terceiro. O pagamento deverá ser realizado à LOCADORA ou à ADMINISTRADORA por PIX, transferência, boleto ou outro meio informado por escrito. A ausência de recebimento de boleto ou aviso não afasta a obrigação de pagamento pontual.`,
  },

  // ─────────── 5. CAUÇÃO (só em contrato com caução) ───────────
  {
    tipo: 'caucao', categoria: 'caucao', titulo: 'Da caução locatícia em dinheiro', numero: 5,
    corpo: `A título de garantia locatícia, o LOCATÁRIO deposita, no ato da assinatura, a quantia de {{CAUCAO_VALOR}} ({{CAUCAO_EXTENSO}}), correspondente a {{CAUCAO_MESES}} (três) meses de aluguel, nos termos do art. 38 da Lei nº 8.245/1991.

Parágrafo primeiro. A caução será depositada em conta específica indicada pela LOCADORA/ADMINISTRADORA, devendo ser restituída ao LOCATÁRIO ao final da locação, com rendimentos correspondentes, após entrega formal das chaves, vistoria final e quitação integral de aluguéis, IPTU, consumos, encargos, multas, danos e reparos.

Parágrafo segundo. A caução garante todas as obrigações locatícias até a efetiva devolução do IMÓVEL, podendo ser utilizada pela LOCADORA/ADMINISTRADORA para compensar débitos vencidos, danos constatados, reparos ou despesas de cobrança, mediante demonstrativo.

Parágrafo terceiro. O LOCATÁRIO não poderá, por decisão unilateral, deixar de pagar aluguel, IPTU ou encargos sob alegação de existência da caução. O uso da caução para quitação dos últimos aluguéis somente poderá ocorrer mediante autorização expressa, prévia e escrita da LOCADORA/ADMINISTRADORA.

Parágrafo quarto. A caução não se confunde com seguro fiança, fiança pessoal, título de capitalização ou qualquer outra modalidade de garantia.`,
  },

  // ─────────── 6. FIADOR (só em contrato com fiador) ───────────
  {
    tipo: 'fiador', categoria: 'fiador', titulo: 'Do fiador e responsabilidade solidária', numero: 5,
    corpo: `Compõe este contrato, na qualidade de FIADOR e principal pagador, {{FIADOR_NOME}}, portador(a) do CPF nº {{FIADOR_CPF}}, RG {{FIADOR_RG}}, residente e domiciliado(a) em {{FIADOR_ENDERECO}}, que se obriga solidariamente com o LOCATÁRIO pelo cumprimento integral de todas as obrigações deste contrato, incluindo aluguel, IPTU, consumos, encargos, multas, danos, reparos, custas e honorários.

Parágrafo primeiro. A responsabilidade do FIADOR perdura até a efetiva devolução do IMÓVEL com vistoria final aceita, quitação integral dos débitos e assinatura do termo de encerramento, inclusive em caso de prorrogação por prazo indeterminado, nos termos do art. 39 da Lei nº 8.245/1991.

Parágrafo segundo. O FIADOR renuncia expressamente aos benefícios de ordem e exoneração, podendo ser cobrado integralmente, sem necessidade de prévia execução do LOCATÁRIO.

Parágrafo terceiro. Falecendo, tornando-se insolvente, ou perdendo o FIADOR a capacidade de garantir a locação, deverá o LOCATÁRIO apresentar nova garantia idônea no prazo de 30 (trinta) dias, sob pena de rescisão.`,
  },

  // ─────────── 6b. SEGURO FIANÇA ───────────
  {
    tipo: 'seguro_fianca', categoria: 'seguro', titulo: 'Do seguro fiança locatícia', numero: 5,
    corpo: `A garantia locatícia deste contrato é prestada por SEGURO FIANÇA emitido pela seguradora {{SEGURO_SEGURADORA}}, apólice nº {{SEGURO_APOLICE}}, com cobertura de {{SEGURO_VALOR}} e vigência de {{SEGURO_VIGENCIA}}.

Parágrafo primeiro. Compete ao LOCATÁRIO manter o seguro vigente durante toda a locação, providenciando renovação tempestiva e apresentando comprovante à ADMINISTRADORA com pelo menos 30 (trinta) dias de antecedência do vencimento da apólice.

Parágrafo segundo. A não renovação do seguro, sua suspensão ou cancelamento configurará infração contratual grave, ensejando rescisão imediata, sem prejuízo de exigência de outra garantia idônea no prazo de 15 (quinze) dias.

Parágrafo terceiro. O LOCATÁRIO autoriza expressamente que a LOCADORA/ADMINISTRADORA acione diretamente a seguradora para recebimento de aluguéis, encargos, multas, danos e demais valores devidos, independentemente de prévia notificação ao LOCATÁRIO.`,
  },

  // ─────────── 6c. SEGURO INCÊNDIO ───────────
  {
    tipo: 'seguro_incendio', categoria: 'seguro', titulo: 'Do seguro de incêndio obrigatório', numero: 6,
    corpo: `Obriga-se o LOCATÁRIO, nos termos do art. 22, VIII da Lei nº 8.245/1991, a contratar e manter vigente, durante toda a locação, seguro contra incêndio, raio e explosão, em favor da LOCADORA, com cobertura suficiente para reconstrução total do IMÓVEL.

Parágrafo primeiro. O comprovante da apólice deverá ser apresentado à ADMINISTRADORA no prazo de 15 (quinze) dias da assinatura deste contrato, e a cada renovação anual.

Parágrafo segundo. A não contratação ou não renovação do seguro de incêndio configurará infração contratual, autorizando a ADMINISTRADORA a contratá-lo às expensas do LOCATÁRIO, cobrando-lhe o valor com os mesmos encargos do aluguel em mora.`,
  },

  // ─────────── 7. REAJUSTE ───────────
  {
    tipo: 'generica', categoria: 'reajuste', titulo: 'Do reajuste', numero: 7,
    corpo: `O aluguel será reajustado anualmente, a cada período de 12 (doze) meses contados do início da locação, pela variação acumulada do IPCA/IBGE, ou, na impossibilidade de utilização deste índice, por outro índice oficial que o substitua ou por índice convencionado entre as partes por escrito.

Parágrafo primeiro. O reajuste incidirá exclusivamente sobre o aluguel, sem prejuízo da atualização de IPTU, tributos, taxas e tarifas conforme valores efetivamente cobrados pelos órgãos competentes.

Parágrafo segundo. A ausência de cobrança imediata do reajuste não caracteriza renúncia, podendo a diferença ser cobrada posteriormente, respeitados os limites legais aplicáveis.`,
  },

  // ─────────── 8. MORA ───────────
  {
    tipo: 'generica', categoria: 'mora', titulo: 'Da mora, multa, juros, cobrança e despejo', numero: 8,
    corpo: `O não pagamento do aluguel, IPTU ou qualquer encargo na data de vencimento constituirá o LOCATÁRIO em mora de pleno direito, independentemente de aviso, interpelação ou notificação.

Parágrafo primeiro. Em caso de atraso, incidirão sobre o débito: multa moratória de 10% (dez por cento); juros de mora de 1% (um por cento) ao mês, proporcionais aos dias de atraso; correção monetária pelo IPCA/IBGE; despesas bancárias, cartorárias, administrativas e de cobrança; e honorários advocatícios ou de cobrança, quando houver atuação extrajudicial ou judicial.

Parágrafo segundo. A partir do primeiro atraso, a ADMINISTRADORA poderá realizar cobrança por telefone, WhatsApp, e-mail, carta, notificação, boleto atualizado, acordo, protesto, inscrição em órgãos de proteção ao crédito e demais meios admitidos em direito.

Parágrafo terceiro. Persistindo inadimplência por prazo superior a 60 (sessenta) dias, ou havendo atraso equivalente a 02 (dois) meses de aluguel/encargos, a LOCADORA e/ou a ADMINISTRADORA poderão considerar o contrato rescindido por inadimplemento e promover ação de despejo por falta de pagamento cumulada com cobrança.`,
  },

  // ─────────── 9. DESTINAÇÃO ───────────
  {
    tipo: 'generica', categoria: 'destinacao', titulo: 'Da destinação, ocupantes e responsabilidade solidária', numero: 9,
    corpo: `O IMÓVEL deverá ser utilizado exclusivamente como residência do LOCATÁRIO e de seus dependentes diretos, sendo vedada a permanência habitual de terceiros não informados, hospedagem comercial, repasse de posse, sublocação, cessão, comodato ou uso por pessoas estranhas sem autorização expressa.

Parágrafo único. O LOCATÁRIO responderá integralmente por atos de seus familiares, visitantes, empregados, prestadores de serviço, animais e quaisquer terceiros que ingressem no IMÓVEL por sua autorização, inclusive por danos, perturbação de vizinhança, infrações legais, multas, acidentes e prejuízos.`,
  },

  // ─────────── 10. CONSERVAÇÃO ───────────
  {
    tipo: 'generica', categoria: 'conservacao', titulo: 'Da conservação, manutenção e vícios estruturais', numero: 10,
    corpo: `O LOCATÁRIO recebe o IMÓVEL no estado de uso, conservação, pintura, limpeza e funcionamento descrito no termo de vistoria inicial, obrigando-se a conservá-lo, limpá-lo, utilizá-lo adequadamente e devolvê-lo ao final no mesmo estado em que o recebeu, ressalvado o desgaste natural decorrente do uso regular.

Parágrafo primeiro. Ficam ressalvados vícios estruturais, defeitos ocultos, problemas preexistentes, falhas construtivas, infiltrações, trincas, problemas de telhado, fundação, rede hidráulica e elétrica embutida não causados pelo LOCATÁRIO. Tais vícios são de responsabilidade da LOCADORA, desde que comunicados imediatamente e não agravados por omissão.

Parágrafo segundo. Serão de responsabilidade do LOCATÁRIO os reparos decorrentes de mau uso, falta de limpeza, falta de manutenção ordinária, negligência, imprudência ou imperícia, incluindo quebras de vidros, fechaduras, torneiras, registros, louças, portas, controles, tomadas, interruptores, lâmpadas, ralos, sifões, pias, vasos sanitários e demais itens de uso cotidiano.`,
  },

  // ─────────── 11. RESCISÃO ───────────
  {
    tipo: 'generica', categoria: 'rescisao', titulo: 'Da rescisão, multa contratual e aviso prévio', numero: 11,
    corpo: `Caso o LOCATÁRIO desocupe o IMÓVEL antes do término do prazo de {{PRAZO_MESES}} ({{PRAZO_EXTENSO}}) meses, deverá pagar multa rescisória equivalente a 03 (três) aluguéis vigentes, calculada proporcionalmente ao tempo restante do contrato, conforme art. 4º da Lei nº 8.245/1991.

Parágrafo primeiro. Fórmula: multa devida = (3 aluguéis ÷ {{PRAZO_MESES}} meses) × meses faltantes.

Parágrafo segundo. O LOCATÁRIO deverá comunicar a intenção de desocupação com antecedência mínima de 30 (trinta) dias, por escrito. A ausência de aviso prévio sujeitará o LOCATÁRIO ao pagamento de indenização equivalente a 01 (um) aluguel vigente.

Parágrafo terceiro. A locação somente será considerada encerrada após entrega formal das chaves, vistoria final, quitação integral dos débitos e assinatura do termo de encerramento.`,
  },

  // ─────────── 12. FORO ───────────
  {
    tipo: 'generica', categoria: 'finais', titulo: 'Disposições finais e foro', numero: 12,
    corpo: `As partes reconhecem a validade de assinatura física ou eletrônica deste instrumento, inclusive por plataforma digital, certificado digital ou outro meio que permita identificação dos signatários, nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.

Eventual nulidade de uma cláusula não afetará as demais, que permanecerão válidas e exigíveis.

Fica eleito o foro da Comarca de Cuiabá-MT para dirimir quaisquer dúvidas, cobranças, ações de despejo, execução, indenização ou controvérsias decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

E, por estarem justos e contratados, assinam o presente instrumento digitalmente, em vias de igual teor, juntamente com 02 (duas) testemunhas.`,
  },
]
