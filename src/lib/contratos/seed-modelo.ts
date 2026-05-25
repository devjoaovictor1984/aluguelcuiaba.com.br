/**
 * Seed das cláusulas pro contrato de locação residencial urbana.
 * Modelo IMOBILIATTO — caução / fiador / seguro fiança / sem garantia,
 * combináveis com seguro incêndio (cobrado à parte / embutido / dispensado).
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
  // ════════════════════════════════════════════════════════════════
  //  GENÉRICAS — vão em todos os contratos
  // ════════════════════════════════════════════════════════════════

  // 1. PARTES
  {
    tipo: 'generica', categoria: 'partes', titulo: 'Das partes', numero: 1,
    corpo: `LOCADOR / PROPRIETÁRIO: {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, {{LOCADOR_PROFISSAO}}, portador(a) do CPF nº {{LOCADOR_CPF}} e RG {{LOCADOR_RG}}, residente e domiciliado(a) em {{LOCADOR_ENDERECO}}, doravante denominado(a) simplesmente LOCADOR, neste ato representado(a), para fins de administração, cobrança, recebimento, entrega de chaves, vistoria e demais atos locatícios, pela ADMINISTRADORA abaixo qualificada.

ADMINISTRADORA: {{ADMIN_RAZAO_SOCIAL}}, pessoa jurídica de direito privado, inscrita no CNPJ nº {{ADMIN_CNPJ}}, CRECI Jurídico {{ADMIN_CRECI_J}}, com sede em {{ADMIN_ENDERECO}}, neste ato representada por {{ADMIN_RESPONSAVEL}}, corretor(a) de imóveis, CRECI {{ADMIN_RESPONSAVEL_CRECI}}, doravante denominada simplesmente ADMINISTRADORA.

LOCATÁRIO: {{LOCATARIO_NOME}}, {{LOCATARIO_NACIONALIDADE}}, {{LOCATARIO_ESTADO_CIVIL}}, {{LOCATARIO_PROFISSAO}}, nascido(a) em {{LOCATARIO_DATA_NASC}}, natural de {{LOCATARIO_NATURALIDADE}}, portador(a) do RG {{LOCATARIO_RG}} e CPF nº {{LOCATARIO_CPF}}, filho(a) de {{LOCATARIO_NOME_PAI}} e {{LOCATARIO_NOME_MAE}}, residente e domiciliado(a) em {{LOCATARIO_ENDERECO}}, doravante denominado(a) LOCATÁRIO.

As partes ajustam o presente CONTRATO DE LOCAÇÃO RESIDENCIAL COM ADMINISTRAÇÃO IMOBILIÁRIA, regido pela Lei nº 8.245/1991, pelo Código Civil, pelo Código de Processo Civil e pelas cláusulas a seguir.`,
  },

  // 2. OBJETO
  {
    tipo: 'generica', categoria: 'objeto', titulo: 'Do objeto da locação', numero: 2,
    corpo: `O presente contrato tem por objeto a locação residencial do imóvel situado em {{IMOVEL_ENDERECO}}, CEP {{IMOVEL_CEP}}, doravante denominado simplesmente IMÓVEL.

Parágrafo primeiro. {{IMOVEL_DESCRICAO}}

Parágrafo segundo. O IMÓVEL é locado para finalidade exclusivamente residencial, sendo vedado seu uso para atividade comercial, industrial, hospedagem por diária, locação por temporada, Airbnb, sublocação, cessão, comodato, repasse de posse ou uso por terceiros sem autorização prévia e expressa do LOCADOR e da ADMINISTRADORA.

Parágrafo terceiro. O LOCADOR declara ser legítimo proprietário, possuidor ou titular apto a dar o IMÓVEL em locação, respondendo por vícios, defeitos e obrigações anteriores à entrega das chaves, nos limites da legislação aplicável.`,
  },

  // 3. DESTINAÇÃO
  {
    tipo: 'generica', categoria: 'destinacao', titulo: 'Da destinação residencial e ocupação', numero: 3,
    corpo: `O IMÓVEL deverá ser utilizado exclusivamente como residência do LOCATÁRIO e de seus dependentes diretos, sendo vedada a permanência habitual de terceiros não informados, hospedagem comercial, repasse de posse, sublocação, cessão, comodato ou uso por pessoas estranhas sem autorização expressa do LOCADOR/ADMINISTRADORA.

Parágrafo único. O LOCATÁRIO responderá integralmente por atos de seus familiares, visitantes, empregados, prestadores de serviço, animais e quaisquer terceiros que ingressem no IMÓVEL por sua autorização, inclusive por danos, perturbação de vizinhança, infrações legais, multas, acidentes e prejuízos.`,
  },

  // 4. PRAZO (texto detalhado do prompt)
  {
    tipo: 'generica', categoria: 'prazo', titulo: 'Do prazo da locação', numero: 4,
    corpo: `O prazo da presente locação é de {{PRAZO_MESES}} ({{PRAZO_EXTENSO}}) meses, com início em {{DATA_INICIO}} e término em {{DATA_FIM}}.

Parágrafo primeiro. Findo o prazo contratual, caso o LOCATÁRIO permaneça no imóvel por mais de 30 (trinta) dias sem oposição do LOCADOR ou da ADMINISTRADORA, a locação poderá prorrogar-se por prazo indeterminado, mantidas as cláusulas compatíveis deste contrato.

Parágrafo segundo. A contagem do prazo contratual inicia-se na data de entrega das chaves, ainda que o primeiro vencimento do aluguel ocorra em data posterior, conforme ajuste financeiro previsto neste instrumento.

Parágrafo terceiro. O prazo contratual é pactuado de forma expressa, por escrito, para fins de locação residencial urbana, nos termos da legislação locatícia aplicável.`,
  },

  // 5. ENTREGA DAS CHAVES (texto detalhado do prompt)
  {
    tipo: 'generica', categoria: 'chaves', titulo: 'Da entrega das chaves e início da posse', numero: 5,
    corpo: `A entrega das chaves ocorrerá na data de início desta locação, desde que estejam cumpridas as seguintes condições:

I. assinatura do presente contrato por todas as partes;
II. assinatura do laudo de vistoria inicial ou termo de vistoria simplificada;
III. pagamento dos valores de entrada, quando houver;
IV. formalização da garantia locatícia, quando aplicável;
V. contratação ou definição do seguro incêndio, quando exigido;
VI. apresentação dos documentos solicitados pela ADMINISTRADORA.

Parágrafo primeiro. Este instrumento poderá servir também como TERMO DE ENTREGA DE CHAVES, declarando o LOCATÁRIO que, na data acima, recebe a posse direta do imóvel para uso exclusivamente residencial.

Parágrafo segundo. A partir da entrega das chaves, o LOCATÁRIO assume responsabilidade pela guarda, conservação, limpeza, pagamento dos encargos, consumos, tributos e demais obrigações vinculadas ao uso do IMÓVEL.

Parágrafo terceiro. A simples assinatura do contrato, sem a entrega formal das chaves, não transfere a posse direta ao LOCATÁRIO, salvo se houver declaração expressa em sentido contrário.`,
  },

  // 6. ALUGUEL, ENCARGOS E FORMA DE PAGAMENTO (texto detalhado do prompt)
  {
    tipo: 'generica', categoria: 'aluguel', titulo: 'Do valor do aluguel, encargos e forma de pagamento', numero: 6,
    corpo: `O aluguel mensal ajustado é de {{ALUGUEL_VALOR}} ({{ALUGUEL_EXTENSO}}), com vencimento todo dia {{VENCIMENTO_DIA}} de cada mês.

Parágrafo primeiro. Além do aluguel, serão de responsabilidade do LOCATÁRIO os seguintes encargos, quando aplicáveis:
I. condomínio ordinário;
II. IPTU proporcional ou mensal;
III. água;
IV. energia elétrica;
V. gás;
VI. internet;
VII. seguro incêndio;
VIII. seguro-fiança, quando essa for a modalidade de garantia;
IX. multas condominiais causadas pelo LOCATÁRIO, ocupantes, visitantes ou terceiros sob sua responsabilidade;
X. demais despesas vinculadas ao uso do imóvel.

Parágrafo segundo. O valor mensal total estimado, considerando aluguel e IPTU mensal, é de {{TOTAL_MENSAL}}.

Parágrafo terceiro. O pagamento deverá ser realizado por PIX, transferência, boleto ou outro meio informado por escrito pela ADMINISTRADORA ou pelo LOCADOR.

Parágrafo quarto. O não recebimento de boleto, mensagem, aviso ou cobrança não isenta o LOCATÁRIO do pagamento pontual, cabendo-lhe solicitar a segunda via ou os dados de pagamento antes do vencimento.

Parágrafo quinto. Pagamentos parciais, tolerâncias, atrasos aceitos, acordos pontuais ou recebimentos fora do prazo não caracterizam novação, renúncia de direito, perdão de dívida ou alteração definitiva das condições deste contrato.`,
  },

  // 7. REAJUSTE
  {
    tipo: 'generica', categoria: 'reajuste', titulo: 'Do reajuste', numero: 7,
    corpo: `O aluguel será reajustado anualmente, a cada período de 12 (doze) meses contados do início da locação, pela variação acumulada do IPCA/IBGE, ou, na impossibilidade de utilização deste índice, por outro índice oficial que o substitua ou por índice convencionado entre as partes por escrito.

Parágrafo primeiro. O reajuste incidirá exclusivamente sobre o aluguel, sem prejuízo da atualização de IPTU, condomínio, tributos, taxas, tarifas e encargos conforme valores efetivamente cobrados pelos órgãos competentes ou prestadores de serviço.

Parágrafo segundo. A ausência de cobrança imediata do reajuste não caracteriza renúncia, podendo a diferença ser cobrada posteriormente, respeitados os limites legais aplicáveis.`,
  },

  // 8. MORA, MULTA, JUROS E COBRANÇA (texto detalhado do prompt)
  {
    tipo: 'generica', categoria: 'mora', titulo: 'Da mora, multa, juros e cobrança', numero: 8,
    corpo: `O não pagamento do aluguel, encargos, seguros, consumos, multas ou qualquer obrigação pecuniária na data de vencimento constituirá o LOCATÁRIO em mora de pleno direito, independentemente de aviso, interpelação ou notificação.

Parágrafo primeiro. Em caso de atraso, incidirão sobre o débito:
I. multa moratória de 10% (dez por cento) sobre o valor em atraso;
II. juros de mora de 1% (um por cento) ao mês, calculados proporcionalmente aos dias de atraso;
III. correção monetária pelo IPCA/IBGE ou índice que venha a substituí-lo;
IV. despesas bancárias, cartorárias, administrativas e de cobrança, quando houver;
V. honorários advocatícios ou de cobrança, quando houver atuação extrajudicial ou judicial.

Parágrafo segundo. A ADMINISTRADORA e/ou o LOCADOR poderão realizar cobrança por telefone, WhatsApp, e-mail, carta, notificação, boleto atualizado, protesto, inscrição em órgãos de proteção ao crédito e demais meios admitidos em direito.

Parágrafo terceiro. A inadimplência poderá ensejar ação de despejo por falta de pagamento, cobrança dos débitos, rescisão contratual, execução do contrato, acionamento da garantia, quando houver, e demais medidas legais cabíveis.`,
  },

  // 9. RESCISÃO ANTECIPADA E MULTA (texto detalhado do prompt)
  {
    tipo: 'generica', categoria: 'rescisao', titulo: 'Da rescisão antecipada e da multa proporcional', numero: 9,
    corpo: `Caso o LOCATÁRIO desocupe o imóvel antes do término do prazo de {{PRAZO_MESES}} ({{PRAZO_EXTENSO}}) meses, deverá pagar multa rescisória equivalente a 03 (três) aluguéis vigentes, calculada proporcionalmente ao tempo restante do contrato.

Parágrafo primeiro. A fórmula de cálculo da multa será: Multa devida = (3 aluguéis vigentes ÷ {{PRAZO_MESES}} meses) × número de meses faltantes para o término do contrato.

Parágrafo segundo. A base de cálculo da multa será o aluguel vigente na data da rescisão, excluídos condomínio, IPTU, seguro-fiança, seguro incêndio, água, energia, gás, internet e demais consumos individualizados, salvo disposição expressa em contrário.

Parágrafo terceiro. Caso haja cláusula de saída sem multa após 12 (doze) meses, o LOCATÁRIO poderá rescindir o contrato sem incidência da multa rescisória após o cumprimento mínimo de 12 meses completos de locação, desde que comunique o LOCADOR ou a ADMINISTRADORA por escrito com antecedência mínima de 30 (trinta) dias, pague todos os valores devidos até a entrega das chaves e devolva o imóvel nas condições da vistoria inicial.

Parágrafo quarto. Caso o LOCATÁRIO desocupe o imóvel antes de completados 12 meses de locação, a multa rescisória será devida proporcionalmente ao prazo restante.

Parágrafo quinto. A ausência de aviso prévio de 30 (trinta) dias sujeitará o LOCATÁRIO ao pagamento de indenização equivalente a 01 (um) aluguel vigente, sem prejuízo da multa proporcional, quando cabível.

Parágrafo sexto. A multa rescisória não se confunde com multa por atraso, indenização por danos, cobrança de encargos, despesas cartorárias, honorários, reparos, pintura, limpeza ou valores de consumo.

Parágrafo sétimo. A locação somente será considerada encerrada após entrega formal das chaves, vistoria final, quitação integral dos débitos existentes e assinatura de termo de encerramento ou recibo de entrega de chaves.`,
  },

  // 10. VISTORIA, CONSERVAÇÃO, PINTURA E DEVOLUÇÃO
  {
    tipo: 'generica', categoria: 'vistoria', titulo: 'Da vistoria inicial, conservação, pintura e devolução', numero: 10,
    corpo: `O LOCATÁRIO recebe o IMÓVEL no estado de uso, conservação, pintura, limpeza e funcionamento descrito no termo de vistoria inicial, obrigando-se a conservá-lo, limpá-lo, utilizá-lo adequadamente e devolvê-lo, ao final da locação, no mesmo estado em que o recebeu, ressalvado o desgaste natural decorrente do uso regular.

Parágrafo primeiro. O LOCATÁRIO terá o prazo de até 05 (cinco) dias úteis, contados da entrega das chaves, para apontar por escrito divergências relevantes não descritas na vistoria inicial, acompanhadas de fotos ou vídeos. O silêncio será interpretado como concordância com o estado de conservação descrito, ressalvados vícios ocultos ou estruturais não aparentes.

Parágrafo segundo. Ficam ressalvados vícios estruturais, defeitos ocultos, problemas preexistentes, falhas construtivas, infiltrações, trincas, telhado, fundação, rede hidráulica e elétrica embutida não causados pelo LOCATÁRIO. Tais vícios são de responsabilidade do LOCADOR, desde que comunicados imediatamente e não agravados por omissão, mau uso ou intervenção indevida.

Parágrafo terceiro. A devolução do IMÓVEL somente será considerada efetiva após entrega formal de todas as chaves, controles, tags e acessos, realização da vistoria final, quitação integral de aluguel, IPTU, consumos e encargos, reparação ou indenização de danos apurados, baixa ou transferência das contas de consumo e assinatura do termo de encerramento.`,
  },

  // 11. OBRIGAÇÕES DO LOCATÁRIO
  {
    tipo: 'generica', categoria: 'obrigacoes_loc', titulo: 'Das obrigações do locatário', numero: 11,
    corpo: `Além das demais obrigações previstas neste contrato e na lei, o LOCATÁRIO obriga-se a:
I. pagar pontualmente aluguel, IPTU, condomínio, água, energia, gás, encargos, seguros, multas e demais despesas sob sua responsabilidade;
II. usar o IMÓVEL exclusivamente para moradia residencial, preservando vizinhança, sossego, segurança e normas locais;
III. conservar o IMÓVEL como se seu fosse, evitando deterioração, sujeira excessiva, danos e uso incompatível;
IV. não transferir, emprestar, sublocar, ceder ou permitir uso por terceiros sem autorização expressa;
V. não realizar obras, alterações, pinturas ou instalações fixas sem autorização escrita;
VI. comunicar imediatamente danos, defeitos, infiltrações, vazamentos, notificações, multas, cobranças e intimações;
VII. pagar multas decorrentes de sua conduta, de seus ocupantes, visitantes, animais ou prestadores de serviço;
VIII. manter contas de consumo em dia e apresentar comprovantes quando solicitados;
IX. permitir vistorias e visitas conforme previsto neste contrato;
X. devolver o IMÓVEL livre de pessoas e bens, limpo, com chaves, controles, acessos e encargos quitados.`,
  },

  // 12. OBRIGAÇÕES DO LOCADOR
  {
    tipo: 'generica', categoria: 'obrigacoes_locador', titulo: 'Das obrigações do locador', numero: 12,
    corpo: `Compete ao LOCADOR:
I. entregar o IMÓVEL em estado de servir ao uso residencial a que se destina;
II. garantir, durante a locação, o uso pacífico do IMÓVEL, ressalvadas hipóteses de infração contratual;
III. responder por vícios, defeitos anteriores, problemas estruturais e reparos extraordinários não causados pelo LOCATÁRIO;
IV. fornecer recibos discriminados dos valores pagos, quando solicitado;
V. receber comunicações, analisar reparos, autorizações, vistorias, cobranças e encerramento contratual.`,
  },

  // 13. OBRIGAÇÕES DA ADMINISTRADORA
  {
    tipo: 'generica', categoria: 'obrigacoes_adm', titulo: 'Das obrigações da administradora', numero: 13,
    corpo: `Compete à ADMINISTRADORA, na condição de mandatária do LOCADOR:
I. intermediar a locação, cobrança, recebimento e prestação de contas dos valores locatícios;
II. providenciar a entrega de chaves, vistorias inicial e final, notificações e comunicações entre as partes;
III. acompanhar a manutenção do IMÓVEL, recebendo e analisando solicitações de reparos;
IV. adotar medidas de cobrança extrajudicial e indicar medidas judiciais cabíveis em caso de inadimplência;
V. prestar contas ao LOCADOR conforme contrato de administração imobiliária firmado entre eles.`,
  },

  // 14. MANUTENÇÕES, REPAROS E BENFEITORIAS
  {
    tipo: 'generica', categoria: 'manutencao', titulo: 'Manutenções, reparos e benfeitorias', numero: 14,
    corpo: `Serão de responsabilidade do LOCATÁRIO os reparos decorrentes de mau uso, falta de limpeza, falta de manutenção ordinária, negligência, imprudência ou imperícia, incluindo quebras de vidros, fechaduras, torneiras, registros, louças, portas, controles, tomadas, interruptores, lâmpadas, ralos, sifões, pias, vasos sanitários, entupimentos por uso inadequado e demais itens de uso cotidiano.

Parágrafo primeiro. Qualquer modificação interna ou externa, pintura, furação relevante, instalação fixa, alteração elétrica, hidráulica, estrutural, troca de revestimento, instalação de ar-condicionado, antena, toldo, câmera, grade, cerca, pergolado, armário, divisória ou qualquer obra dependerá de autorização prévia, expressa e escrita do LOCADOR/ADMINISTRADORA.

Parágrafo segundo. Benfeitorias úteis e voluptuárias realizadas sem autorização não serão indenizadas e não conferirão direito de retenção, podendo o LOCADOR exigir a remoção e restauração do estado anterior, às expensas do LOCATÁRIO.

Parágrafo terceiro. Benfeitorias necessárias urgentes deverão ser comunicadas imediatamente. Em situação emergencial que comprometa segurança, habitabilidade ou integridade do IMÓVEL, o LOCATÁRIO deverá adotar medidas mínimas para evitar agravamento do dano, comunicando a ADMINISTRADORA com urgência.`,
  },

  // 15. VISITAS E VISTORIAS PERIÓDICAS
  {
    tipo: 'generica', categoria: 'visitas', titulo: 'Vistorias e visitas ao imóvel', numero: 15,
    corpo: `O LOCADOR, a ADMINISTRADORA ou pessoa por eles autorizada poderá realizar vistorias periódicas no IMÓVEL, mediante aviso prévio mínimo de 48 (quarenta e oito) horas e agendamento de dia e horário compatíveis, para verificar conservação, uso, manutenção, reparos, medidores, fotos, documentação, avaliação, seguros, venda ou necessidade administrativa.

Parágrafo único. Em caso de venda, avaliação ou anúncio do IMÓVEL, o LOCATÁRIO deverá permitir visitas de interessados, corretores, avaliadores e prestadores de serviço, sempre com agendamento prévio razoável, respeitada a privacidade e a rotina residencial.`,
  },

  // 16. DIREITO DE PREFERÊNCIA
  {
    tipo: 'generica', categoria: 'preferencia', titulo: 'Do direito de preferência em caso de venda', numero: 16,
    corpo: `Caso o LOCADOR decida vender o IMÓVEL durante a vigência da locação, o LOCATÁRIO terá direito de preferência em igualdade de condições com terceiros, devendo ser comunicado por escrito sobre preço, forma de pagamento, condições do negócio, existência de ônus e demais informações relevantes.

Parágrafo primeiro. Recebida a comunicação, o LOCATÁRIO terá o prazo legal de 30 (trinta) dias para manifestar, por escrito, aceitação integral da proposta. O silêncio, a recusa, a contraproposta não aceita ou a ausência de resposta no prazo autorizarão o LOCADOR a vender o IMÓVEL a terceiros nas condições comunicadas ou em condições legalmente permitidas.

Parágrafo segundo. A eventual venda do IMÓVEL não extingue automaticamente a locação, que seguirá conforme a lei e as condições contratuais oponíveis ao adquirente, observadas as exigências legais de averbação/registro quando aplicáveis.`,
  },

  // 17. INFRAÇÕES CONTRATUAIS E CONDOMINIAIS
  {
    tipo: 'generica', categoria: 'infracoes', titulo: 'Infrações contratuais e condominiais', numero: 17,
    corpo: `Caracterizam infração contratual grave, autorizando a rescisão e demais medidas cabíveis: atraso superior a 60 (sessenta) dias; acúmulo de 02 (dois) meses de aluguel/encargos; abandono do IMÓVEL; uso diverso ou ilícito; sublocação/cessão não autorizada; dano relevante; recusa injustificada de vistoria; ausência de comunicação de vícios que causem agravamento do dano; e descumprimento reiterado de regras condominiais.

Parágrafo único. Multas aplicadas pelo condomínio em razão de conduta do LOCATÁRIO, ocupantes, visitantes, prestadores de serviço ou animais são de responsabilidade exclusiva do LOCATÁRIO, podendo ser cobradas juntamente com os encargos locatícios.`,
  },

  // 18. COMUNICAÇÕES E NOTIFICAÇÕES
  {
    tipo: 'generica', categoria: 'comunicacoes', titulo: 'Comunicações e notificações', numero: 18,
    corpo: `As comunicações entre as partes poderão ocorrer por escrito, inclusive WhatsApp, e-mail, SMS, carta, notificação extrajudicial, plataforma de assinatura digital ou outro meio que permita comprovar envio, recebimento ou ciência.

Parágrafo primeiro. Os endereços físicos, e-mails e telefones informados pelo LOCATÁRIO serão considerados válidos até comunicação formal de alteração. A ausência de atualização cadastral não prejudica a validade das notificações encaminhadas aos dados constantes neste contrato.

Parágrafo segundo. O LOCATÁRIO reconhece a validade de notificações encaminhadas pela ADMINISTRADORA, inclusive para cobrança, vistoria, desocupação, venda, direito de preferência, reparos, reajuste, protesto, negativação, rescisão e demais atos relacionados à locação.`,
  },

  // 19. ANEXOS
  {
    tipo: 'generica', categoria: 'anexos', titulo: 'Dos anexos e documentos integrantes', numero: 19,
    corpo: `Integram este contrato, para todos os fins de direito, ainda que fisicamente ou digitalmente arquivados em separado:
I. documentos pessoais das partes (RG/CNH, CPF, comprovante de residência);
II. certidão de casamento ou união estável, quando aplicável;
III. comprovantes de renda, declaração de imposto de renda e documentos cadastrais;
IV. registros fotográficos e vídeos da entrega de chaves e vistoria inicial;
V. termo de vistoria inicial e, ao final, termo de vistoria final;
VI. recibos de pagamento da caução, aluguel, IPTU e demais encargos.

Parágrafo único. A ausência de anexação física imediata de algum documento não invalida o contrato, desde que sua existência possa ser demonstrada por arquivo digital, cópia, imagem, e-mail, WhatsApp, plataforma de assinatura ou outro meio admitido em direito.`,
  },

  // 20. DISPOSIÇÕES FINAIS
  {
    tipo: 'generica', categoria: 'finais', titulo: 'Disposições finais', numero: 20,
    corpo: `Este contrato obriga as partes, seus herdeiros, sucessores e eventuais cessionários autorizados, sendo vedada a cessão de posição contratual pelo LOCATÁRIO sem autorização expressa do LOCADOR/ADMINISTRADORA.

Parágrafo primeiro. A eventual nulidade ou inexigibilidade de uma cláusula não afetará as demais disposições, que permanecerão válidas e exigíveis na maior extensão admitida em direito.

Parágrafo segundo. As partes reconhecem a validade de assinatura física ou eletrônica deste instrumento, inclusive por plataforma digital, certificado digital ou outro meio que permita identificação dos signatários, nos termos da MP 2.200-2/2001 e da Lei 14.063/2020, sem prejuízo da recomendação de assinatura por 02 (duas) testemunhas para reforço de exigibilidade.`,
  },

  // 21. FORO
  {
    tipo: 'generica', categoria: 'foro', titulo: 'Do foro', numero: 21,
    corpo: `Fica eleito o foro da Comarca de Cuiabá-MT para dirimir quaisquer dúvidas, cobranças, ações de despejo, execução, indenização, obrigação de fazer, reparos, rescisão ou controvérsias decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

E, por estarem justos e contratados, plenamente cientes da seriedade das obrigações assumidas, assinam o presente instrumento digitalmente, em vias de igual teor, juntamente com 02 (duas) testemunhas.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  GARANTIAS — cada contrato usa UMA das quatro
  // ════════════════════════════════════════════════════════════════

  // SEM GARANTIA (texto detalhado do prompt)
  {
    tipo: 'sem_garantia', categoria: 'garantia', titulo: 'Da ausência de garantia locatícia', numero: 10,
    corpo: `As partes ajustam expressamente que a presente locação será celebrada sem garantia locatícia, não havendo caução, fiador, seguro-fiança, título de capitalização ou qualquer outra modalidade de garantia.

Parágrafo primeiro. A ausência de garantia locatícia não afasta a obrigação do LOCATÁRIO de pagar pontualmente o aluguel, encargos, tributos, consumos, multas, danos, reparos, despesas de cobrança e demais obrigações previstas neste contrato.

Parágrafo segundo. O inadimplemento de qualquer obrigação pecuniária constituirá o LOCATÁRIO em mora de pleno direito, independentemente de aviso, interpelação ou notificação, autorizando o LOCADOR e/ou a ADMINISTRADORA a adotar as medidas extrajudiciais e judiciais cabíveis, inclusive cobrança, protesto, inscrição em órgãos de proteção ao crédito e ação de despejo por falta de pagamento.

Parágrafo terceiro. A entrega das chaves ficará condicionada à assinatura do contrato, apresentação dos documentos exigidos, assinatura da vistoria inicial e pagamento dos valores de entrada eventualmente ajustados entre as partes.

Parágrafo quarto. A ausência de garantia não autoriza retenção indevida do imóvel, atraso de aluguel, compensação unilateral de valores ou permanência gratuita no imóvel.`,
  },

  // CAUÇÃO (texto detalhado do prompt)
  {
    tipo: 'caucao', categoria: 'garantia', titulo: 'Da garantia locatícia por caução em dinheiro', numero: 10,
    corpo: `A garantia locatícia deste contrato será prestada mediante caução em dinheiro, no valor de {{CAUCAO_VALOR}} ({{CAUCAO_EXTENSO}}), correspondente a {{CAUCAO_MESES}} (três) meses de aluguel, calculada exclusivamente sobre o valor do aluguel mensal de {{ALUGUEL_VALOR}}.

Parágrafo primeiro. A caução não abrangerá, para fins de cálculo de seu limite, valores de condomínio, IPTU, água, energia, gás, internet, seguro incêndio, multas, danos, reparos ou demais encargos acessórios.

Parágrafo segundo. A caução será paga pelo LOCATÁRIO no ato da assinatura deste contrato e antes da entrega das chaves, por meio de PIX, transferência ou boleto, em favor do LOCADOR ou da ADMINISTRADORA, conforme dados informados por escrito.

Parágrafo terceiro. O valor recebido a título de caução possui natureza exclusiva de garantia locatícia, devendo ser apurado ao final da locação, após entrega formal das chaves, realização da vistoria final e quitação integral de aluguéis, encargos, consumos, multas, danos, reparos, limpeza, pintura, despesas de cobrança e demais obrigações contratuais.

Parágrafo quarto. A caução poderá ser utilizada pelo LOCADOR e/ou pela ADMINISTRADORA para compensar débitos vencidos, aluguéis não pagos, IPTU, condomínio, consumos, danos constatados, reparos, limpeza, pintura, multas, despesas de cobrança, custas, honorários e demais obrigações decorrentes deste contrato, mediante demonstrativo.

Parágrafo quinto. O LOCATÁRIO não poderá deixar de pagar aluguel, IPTU, condomínio ou quaisquer encargos sob alegação de existência da caução. A utilização da caução para pagamento dos últimos aluguéis somente poderá ocorrer mediante autorização prévia, expressa e escrita do LOCADOR ou da ADMINISTRADORA.

Parágrafo sexto. Caso, ao final da locação, não existam débitos, danos ou obrigações pendentes, o saldo da caução será restituído ao LOCATÁRIO, observados os rendimentos cabíveis, quando aplicáveis.

Parágrafo sétimo. A caução não se confunde com seguro-fiança, fiança pessoal, título de capitalização ou qualquer outra modalidade de garantia. As partes declaram ciência de que a única garantia locatícia deste contrato é a caução em dinheiro.`,
  },

  // FIADOR (texto detalhado do prompt)
  {
    tipo: 'fiador', categoria: 'garantia', titulo: 'Da garantia locatícia por fiança', numero: 10,
    corpo: `A garantia locatícia deste contrato será prestada por FIADOR, devidamente qualificado neste instrumento, que comparece como garantidor solidário de todas as obrigações assumidas pelo LOCATÁRIO.

FIADOR: {{FIADOR_NOME}}, portador(a) do CPF nº {{FIADOR_CPF}}, RG {{FIADOR_RG}}, residente e domiciliado(a) em {{FIADOR_ENDERECO}}.

Parágrafo primeiro. O FIADOR responsabiliza-se solidariamente pelo pagamento de aluguéis, condomínio, IPTU, água, energia, gás, seguro incêndio, multas, danos, reparos, pintura, limpeza, despesas de cobrança, custas, honorários advocatícios, indenizações e demais obrigações decorrentes deste contrato.

Parágrafo segundo. A responsabilidade do FIADOR permanecerá vigente até a efetiva entrega formal das chaves, realização da vistoria final, quitação integral dos débitos e assinatura do termo de encerramento da locação.

Parágrafo terceiro. A eventual prorrogação da locação por prazo indeterminado manterá a responsabilidade do FIADOR, salvo exoneração formal na forma da lei e após cumprimento dos prazos e condições legalmente aplicáveis.

Parágrafo quarto. O FIADOR declara ter plena ciência das condições deste contrato, do valor da locação, dos encargos, do prazo contratual, da multa rescisória, das obrigações do LOCATÁRIO e dos riscos decorrentes da fiança prestada.

Parágrafo quinto. Sendo o FIADOR casado ou convivente em união estável, deverá haver anuência expressa do cônjuge ou companheiro(a), quando exigida pela legislação aplicável, sob pena de questionamento da validade da garantia.

Parágrafo sexto. O LOCADOR e/ou a ADMINISTRADORA poderão exigir documentos pessoais, comprovantes de renda, certidões, matrícula de imóvel, comprovante de endereço e demais documentos necessários à análise da idoneidade financeira do FIADOR.`,
  },

  // SEGURO FIANÇA (texto detalhado do prompt)
  {
    tipo: 'seguro_fianca', categoria: 'garantia', titulo: 'Da garantia locatícia por seguro-fiança', numero: 10,
    corpo: `A garantia locatícia deste contrato será prestada mediante seguro-fiança locatícia, contratado junto à seguradora {{SEGURO_SEGURADORA}}, apólice nº {{SEGURO_APOLICE}}, conforme proposta, coberturas, condições gerais e critérios de aceitação da seguradora.

Parágrafo primeiro. O custo do seguro-fiança será de responsabilidade exclusiva do LOCATÁRIO, podendo ser cobrado mensalmente, de forma destacada ou juntamente com os demais encargos locatícios, conforme operacionalização da seguradora e/ou da ADMINISTRADORA.

Parágrafo segundo. A entrega das chaves fica condicionada à aprovação cadastral, emissão da proposta ou apólice, pagamento do prêmio inicial quando exigido, assinatura do contrato, assinatura da vistoria inicial e apresentação dos documentos exigidos.

Parágrafo terceiro. A perda da cobertura, recusa cadastral, cancelamento da apólice, inadimplência do prêmio do seguro ou qualquer fato que comprometa a garantia poderá caracterizar infração contratual e autorizar a suspensão da entrega das chaves, cobrança dos valores devidos, rescisão contratual ou adoção das medidas legais cabíveis.

Parágrafo quarto. A apólice garantirá exclusivamente as coberturas expressamente contratadas, tais como aluguel, encargos, multa rescisória, danos ao imóvel, pintura interna, pintura externa ou outras coberturas, quando previstas na proposta e aceitas pela seguradora.

Parágrafo quinto. Caso a seguradora indenize o LOCADOR por débito, dano, multa ou obrigação descumprida pelo LOCATÁRIO, ficará preservado o direito de regresso da seguradora contra o LOCATÁRIO, conforme condições da apólice e legislação aplicável.

Parágrafo sexto. O seguro-fiança não isenta o LOCATÁRIO de cumprir todas as obrigações deste contrato, inclusive pagamento pontual dos aluguéis, encargos, seguros, consumos, multas, reparos, indenizações e devolução regular do imóvel.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  SEGURO INCÊNDIO — 3 variações, usa categoria pra diferenciar
  // ════════════════════════════════════════════════════════════════

  // Cobrado à parte (texto detalhado do prompt)
  {
    tipo: 'seguro_incendio', categoria: 'cobrado_parte', titulo: 'Do seguro incêndio obrigatório cobrado à parte', numero: 11,
    corpo: `O LOCATÁRIO obriga-se a manter seguro incêndio vigente durante todo o período da locação, com cobertura compatível com o imóvel locado e demais condições exigidas pelo LOCADOR, pela ADMINISTRADORA ou pela seguradora.

Parágrafo primeiro. O seguro incêndio poderá ser contratado pela ADMINISTRADORA, com repasse do valor ao LOCATÁRIO, ou diretamente pelo LOCATÁRIO, desde que haja prévia aprovação da ADMINISTRADORA e apresentação da respectiva apólice.

Parágrafo segundo. O valor do seguro incêndio não integra o aluguel e será cobrado à parte, conforme prêmio, renovação, vigência e condições da apólice.

Parágrafo terceiro. A ausência de contratação, pagamento ou renovação do seguro incêndio caracterizará infração contratual, autorizando a ADMINISTRADORA a providenciar a contratação e cobrar o respectivo valor do LOCATÁRIO juntamente com os demais encargos locatícios.`,
  },

  // Embutido no pacote (texto detalhado do prompt)
  {
    tipo: 'seguro_incendio', categoria: 'embutido_pacote', titulo: 'Do seguro incêndio embutido no pacote locatício', numero: 11,
    corpo: `As partes ajustam que o seguro incêndio obrigatório estará incluído no pacote locatício mensal, juntamente com os demais valores descritos neste contrato, sem prejuízo da identificação de sua natureza como obrigação acessória vinculada à locação.

Parágrafo primeiro. O valor global mensal contemplará aluguel e os encargos expressamente indicados no quadro financeiro, incluindo o seguro incêndio, quando assim discriminado.

Parágrafo segundo. Ainda que cobrado dentro do pacote locatício, o seguro incêndio não se confunde com aluguel, garantia locatícia, caução, fiança ou seguro-fiança.

Parágrafo terceiro. Eventual alteração no valor da apólice, renovação, substituição de seguradora ou ajuste do prêmio poderá refletir no pacote locatício ou ser cobrada separadamente, desde que informado ao LOCATÁRIO.`,
  },

  // Dispensado (texto detalhado do prompt)
  {
    tipo: 'seguro_incendio', categoria: 'dispensado', titulo: 'Da dispensa de seguro incêndio', numero: 11,
    corpo: `As partes declaram que, para a presente locação, não será exigida a contratação de seguro incêndio, salvo alteração posterior formalizada por termo aditivo.

Parágrafo único. A dispensa do seguro incêndio não exime o LOCATÁRIO de responder por danos causados ao imóvel por mau uso, culpa, dolo, negligência, imprudência, imperícia, conduta de ocupantes, visitantes, empregados, prestadores de serviço ou terceiros sob sua responsabilidade.`,
  },
]
