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

  // Responsabilidade pelo pagamento do seguro fiança + quem mora no imóvel
  {
    tipo: 'seguro_fianca', categoria: 'garantia', titulo: 'Da responsabilidade pelo pagamento e da ocupação do imóvel', numero: 11,
    corpo: `O custo mensal do seguro-fiança contratado junto à seguradora {{SEGURO_SEGURADORA}}, apólice nº {{SEGURO_APOLICE}}, é de responsabilidade financeira do LOCATÁRIO {{LOCATARIO_NOME}}, portador(a) do CPF nº {{LOCATARIO_CPF}}, que arcará com o pagamento integral do prêmio enquanto vigente esta locação.

Parágrafo primeiro. A ocupação efetiva do IMÓVEL será exercida pelo LOCATÁRIO {{LOCATARIO_NOME}} e seus dependentes diretos. Quaisquer co-locatários, moradores adicionais ou responsáveis financeiros distintos deverão constar nas assinaturas finais com sua respectiva qualificação, respondendo solidariamente pelas obrigações deste contrato.

Parágrafo segundo. Caso o responsável financeiro pelo seguro-fiança seja pessoa distinta do ocupante do imóvel, ambos firmam o presente instrumento com pleno conhecimento e aceitação, mantendo-se a solidariedade nas obrigações locatícias.

Parágrafo terceiro. Em caso de inadimplência do prêmio do seguro-fiança, a SEGURADORA poderá cancelar a apólice, hipótese em que o LOCATÁRIO deverá substituir a garantia em prazo razoável estipulado pela ADMINISTRADORA ou sujeitar-se à rescisão contratual com despejo, sem prejuízo de cobrança e demais medidas legais cabíveis.

Parágrafo quarto. Qualquer alteração no responsável pelo pagamento do prêmio ou na composição dos ocupantes do imóvel deverá ser previamente comunicada por escrito ao LOCADOR ou à ADMINISTRADORA, sob pena de caracterizar infração contratual.`,
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

  // ════════════════════════════════════════════════════════════════
  //  ADICIONAIS — escolhidas caso a caso pelo corretor no editor
  // ════════════════════════════════════════════════════════════════

  // PINTURA — entregue pintado de novo
  {
    tipo: 'adicional', categoria: 'pintura', titulo: 'Da pintura — imóvel entregue pintado de novo', numero: 1,
    corpo: `O IMÓVEL está sendo entregue com PINTURA NOVA, conforme constatado em vistoria inicial.

Parágrafo primeiro. O LOCATÁRIO obriga-se a devolver o IMÓVEL ao final da locação com a mesma qualidade de pintura recebida, providenciando, às suas expensas, pintura nova das paredes internas e demais superfícies pintadas, com tinta e cor compatíveis com as existentes, ressalvado o desgaste natural decorrente do uso regular.

Parágrafo segundo. Caso o LOCATÁRIO opte por não realizar a pintura no momento da devolução, autoriza desde já que o valor correspondente seja descontado da caução ou cobrado adicionalmente, conforme orçamento apresentado pela LOCADORA/ADMINISTRADORA.

Parágrafo terceiro. Manchas anormais, furos excessivos, rabiscos, perfurações, descascamentos provocados por uso indevido ou alteração de cor sem autorização escrita configurarão obrigação adicional de reparo, não confundida com a pintura geral de devolução.`,
  },

  // PINTURA — entregue não pintado de novo (do contrato modelo)
  {
    tipo: 'adicional', categoria: 'pintura', titulo: 'Da pintura — imóvel não entregue com pintura nova', numero: 2,
    corpo: `O IMÓVEL NÃO ESTÁ SENDO ENTREGUE COM PINTURA NOVA, conforme constatado em vistoria inicial.

Parágrafo primeiro. Assim, o LOCATÁRIO não será obrigado a devolvê-lo com pintura nova, salvo se der causa a manchas, furos excessivos, sujeira anormal, pintura irregular, dano, infiltração por mau uso, alteração de cor, rabiscos, perfurações, descascamentos provocados por uso indevido ou qualquer deterioração além do desgaste natural.

Parágrafo segundo. Eventuais reparos pontuais (furos, manchas localizadas, retoques) decorrentes de uso indevido serão de responsabilidade do LOCATÁRIO, podendo ser descontados da caução ou cobrados adicionalmente conforme orçamento.`,
  },

  // ANIMAIS — permitidos com restrições
  {
    tipo: 'adicional', categoria: 'animais', titulo: 'Da permissão de animais de estimação (com restrições)', numero: 3,
    corpo: `Fica autorizada a permanência de animais de estimação no IMÓVEL, observadas as seguintes condições:

I. respeito ao convívio com vizinhança, sossego e regras condominiais, quando aplicáveis;
II. responsabilidade integral do LOCATÁRIO por danos, sujeira, odores, ruídos, ferimentos e prejuízos causados pelos animais a pessoas, móveis, paredes, pisos, jardins, áreas comuns ou terceiros;
III. obrigatoriedade de manter o animal vacinado, vermifugado e em condições sanitárias adequadas;
IV. ao final da locação, devolver o IMÓVEL livre de odores, marcas, arranhões, pelos acumulados em ralos/condutos e demais sinais visíveis da presença do animal, sob pena de cobrança de limpeza e reparos.

Parágrafo único. Reclamações reiteradas de vizinhança ou condomínio relativas aos animais poderão autorizar a LOCADORA/ADMINISTRADORA a exigir a retirada do animal, sob pena de configurar infração contratual.`,
  },

  // ANIMAIS — proibidos
  {
    tipo: 'adicional', categoria: 'animais', titulo: 'Da proibição de animais de estimação', numero: 4,
    corpo: `É expressamente PROIBIDA a permanência de animais de estimação de qualquer espécie no IMÓVEL, salvo autorização prévia, expressa e escrita da LOCADORA/ADMINISTRADORA.

Parágrafo único. O descumprimento desta cláusula configurará infração contratual, autorizando a notificação para retirada imediata do animal e, persistindo o descumprimento, rescisão contratual com cobrança das obrigações cabíveis, sem prejuízo do ressarcimento por eventuais danos.`,
  },

  // MOBILIADO COM INVENTÁRIO
  {
    tipo: 'adicional', categoria: 'mobilia', titulo: 'Do imóvel mobiliado e inventário de móveis', numero: 5,
    corpo: `O IMÓVEL é locado MOBILIADO, contendo móveis, eletrodomésticos, utensílios e demais bens descritos no inventário anexo a este contrato e no termo de vistoria inicial.

Parágrafo primeiro. O LOCATÁRIO recebe os bens em estado de funcionamento e conservação adequados ao uso a que se destinam, obrigando-se a conservá-los, mantê-los limpos, providenciar pequenos reparos decorrentes de uso ordinário e devolvê-los, ao final da locação, no mesmo estado em que os recebeu, ressalvado o desgaste natural.

Parágrafo segundo. A perda, dano, deterioração anormal, furto, extravio ou substituição não autorizada de qualquer item do inventário é de responsabilidade do LOCATÁRIO, que deverá repor item idêntico ou de qualidade equivalente, ou indenizar o valor de reposição.

Parágrafo terceiro. É vedada a remoção dos bens do inventário para fora do IMÓVEL sem autorização prévia, expressa e escrita da LOCADORA/ADMINISTRADORA.`,
  },

  // REFORMA AUTORIZADA
  {
    tipo: 'adicional', categoria: 'reforma', titulo: 'Da autorização para reforma específica', numero: 6,
    corpo: `Fica autorizada, em caráter excepcional, a realização da seguinte reforma/benfeitoria pelo LOCATÁRIO no IMÓVEL: [DETALHAR REFORMA AUTORIZADA].

Parágrafo primeiro. A reforma será integralmente custeada pelo LOCATÁRIO, sem direito a indenização, retenção, abatimento de aluguel ou qualquer compensação posterior, salvo ajuste expresso em contrário.

Parágrafo segundo. O LOCATÁRIO compromete-se a executar a reforma com materiais de qualidade equivalente ou superior aos existentes, contratar profissionais qualificados, observar normas técnicas e de segurança e respeitar o cronograma comunicado à LOCADORA/ADMINISTRADORA.

Parágrafo terceiro. Ao final da locação, a benfeitoria incorporada ao IMÓVEL não gerará direito automático de remoção ou indenização, podendo a LOCADORA/ADMINISTRADORA exigir, conforme conveniência, a restauração do estado anterior às expensas do LOCATÁRIO.`,
  },

  // INTERNET/TV INCLUSAS
  {
    tipo: 'adicional', categoria: 'servicos', titulo: 'Internet e TV inclusas no pacote locatício', numero: 7,
    corpo: `Encontra-se incluído no pacote locatício mensal, ao valor global ajustado neste contrato, o seguinte serviço: [DETALHAR — ex: internet fibra 500 Mbps via operadora X; TV por assinatura plano básico].

Parágrafo primeiro. O LOCATÁRIO usufruirá do serviço durante toda a vigência da locação, sendo de sua responsabilidade o uso adequado dos equipamentos (modem, roteador, decoder, antena), comunicando imediatamente qualquer defeito ou interrupção à LOCADORA/ADMINISTRADORA.

Parágrafo segundo. Mudança de plano, cancelamento, alteração de operadora ou inclusão de serviços adicionais por iniciativa do LOCATÁRIO ocorrerá às suas expensas, mediante autorização prévia e escrita.

Parágrafo terceiro. No término da locação, o LOCATÁRIO devolverá os equipamentos no mesmo estado em que os recebeu, sob pena de cobrança pela reposição.`,
  },

  // VAGAS DETALHADAS
  {
    tipo: 'adicional', categoria: 'garagem', titulo: 'Das vagas de garagem e estacionamento', numero: 8,
    corpo: `O IMÓVEL inclui [QUANTIDADE] vaga(s) de garagem, [DETALHAR LOCALIZAÇÃO — ex: vaga nº 12 e nº 13 no subsolo; ou garagem coberta nos fundos do imóvel].

Parágrafo primeiro. As vagas são de uso exclusivo do LOCATÁRIO e seus ocupantes regulares, sendo vedada cessão, sublocação, troca ou aluguel a terceiros sem autorização expressa.

Parágrafo segundo. O LOCATÁRIO obriga-se a respeitar as regras condominiais e de boa convivência relativas ao uso das vagas, sendo responsável por danos causados a outros veículos, paredes, portões, controles de acesso e demais equipamentos.

Parágrafo terceiro. A LOCADORA/ADMINISTRADORA não responde por furtos, danos, arranhões ou prejuízos a veículos estacionados na garagem, salvo culpa direta comprovada.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  ADICIONAIS — JURÍDICAS (escolhidas caso a caso, mas recomendadas)
  // ════════════════════════════════════════════════════════════════

  // LGPD
  {
    tipo: 'adicional', categoria: 'lgpd', titulo: 'Da proteção de dados pessoais (LGPD)', numero: 10,
    corpo: `As partes declaram ciência e consentimento mútuo para o tratamento de seus dados pessoais constantes deste contrato (nome, CPF, RG, endereço, telefone, e-mail e demais), nos termos da Lei Geral de Proteção de Dados — Lei nº 13.709/2018.

Parágrafo primeiro. O tratamento dos dados terá como finalidade exclusiva a execução deste contrato, cobranças, comunicações, emissão de recibos, registros contábeis e fiscais, defesa em eventuais ações judiciais e cumprimento de obrigações legais.

Parágrafo segundo. As partes obrigam-se a manter sigilo sobre dados pessoais de que tenham conhecimento em razão deste contrato, a adotar medidas razoáveis de segurança e a comunicar incidentes que envolvam tais dados.

Parágrafo terceiro. Os dados serão armazenados pelo prazo necessário ao cumprimento das obrigações contratuais e legais e, ao fim, serão eliminados ou anonimizados, salvo dever legal de guarda.

Parágrafo quarto. Os titulares dos dados poderão exercer os direitos previstos no art. 18 da LGPD mediante requerimento à ADMINISTRADORA, pelos canais de contato informados neste contrato.`,
  },

  // CESSÃO DE POSIÇÃO CONTRATUAL
  {
    tipo: 'adicional', categoria: 'cessao', titulo: 'Da vedação à cessão e sublocação', numero: 11,
    corpo: `É expressamente vedada ao LOCATÁRIO a cessão, transferência, sublocação, comodato, empréstimo ou repasse, total ou parcial, da posição contratual ou do uso do IMÓVEL a terceiros, a qualquer título, sem prévia, expressa e escrita autorização da LOCADORA/ADMINISTRADORA.

Parágrafo único. O descumprimento configurará infração contratual grave, autorizando rescisão imediata com cobrança da multa rescisória e indenização por perdas e danos, sem prejuízo de demais medidas legais cabíveis.`,
  },

  // SUB-ROGAÇÃO (quando há seguradora)
  {
    tipo: 'adicional', categoria: 'subrogacao', titulo: 'Da sub-rogação da seguradora', numero: 12,
    corpo: `Caso a seguradora pague indenização ao LOCADOR em razão de inadimplência, dano ou descumprimento contratual atribuível ao LOCATÁRIO, ficará automaticamente sub-rogada nos direitos do LOCADOR contra o LOCATÁRIO até o limite do valor pago, podendo cobrar diretamente do LOCATÁRIO o ressarcimento integral.

Parágrafo único. O LOCATÁRIO reconhece e aceita expressamente essa sub-rogação, declarando ciência de que o pagamento pela seguradora não extingue sua obrigação principal — apenas transfere o crédito à seguradora.`,
  },

  // DEVER DE INFORMAÇÃO
  {
    tipo: 'adicional', categoria: 'informacao', titulo: 'Do dever de informação e atualização cadastral', numero: 13,
    corpo: `O LOCATÁRIO obriga-se a manter atualizados, junto à ADMINISTRADORA, seus dados pessoais e de contato (telefone, WhatsApp, e-mail, endereço de correspondência) durante toda a vigência da locação e até o encerramento total das obrigações.

Parágrafo primeiro. Toda comunicação enviada aos endereços e contatos constantes deste contrato será considerada válida para todos os fins, sendo de responsabilidade do LOCATÁRIO eventual prejuízo decorrente de desatualização cadastral.

Parágrafo segundo. O LOCATÁRIO obriga-se também a informar imediatamente a ADMINISTRADORA sobre: ações judiciais que possam afetar a locação, problemas estruturais no IMÓVEL, sinistros, danos, notificações públicas, alterações na composição familiar/ocupantes e quaisquer fatos relevantes.`,
  },

  // RENÚNCIA À RETENÇÃO POR BENFEITORIAS
  {
    tipo: 'adicional', categoria: 'benfeitorias', titulo: 'Da renúncia à retenção por benfeitorias', numero: 14,
    corpo: `O LOCATÁRIO renuncia expressamente ao direito de retenção do IMÓVEL por eventuais benfeitorias úteis ou voluptuárias, ainda que autorizadas, salvo ajuste expresso e escrito em contrário previsto neste instrumento ou em termo aditivo.

Parágrafo primeiro. Benfeitorias necessárias urgentes, devidamente comunicadas e justificadas, poderão ser indenizadas ou compensadas com aluguel, mediante prévio acordo escrito.

Parágrafo segundo. Esta renúncia se estende a fiador, cônjuge e demais ocupantes do IMÓVEL.`,
  },

  // INDENIZAÇÃO POR DANOS
  {
    tipo: 'adicional', categoria: 'danos', titulo: 'Da indenização por danos ao imóvel', numero: 15,
    corpo: `Sem prejuízo da multa rescisória e demais cominações, o LOCATÁRIO indenizará integralmente o LOCADOR pelos danos que vier a causar ao IMÓVEL, móveis, equipamentos, instalações e demais bens, decorrentes de mau uso, culpa, dolo, negligência, imprudência ou imperícia, próprios ou de seus familiares, visitantes, empregados, prestadores de serviço ou animais.

Parágrafo primeiro. Os danos serão apurados em vistoria final, podendo ser objeto de orçamentos prévios apresentados ao LOCATÁRIO, com prazo razoável de manifestação.

Parágrafo segundo. O valor da indenização poderá ser descontado da caução, quando houver, ou cobrado em parcela única ou de forma parcelada, conforme acordo, sem prejuízo da cobrança judicial em caso de inadimplência.`,
  },

  // ALUGUEL INCLUI IPTU
  {
    tipo: 'adicional', categoria: 'aluguel_inclui', titulo: 'IPTU incluso no aluguel', numero: 16,
    corpo: `Para a presente locação, o valor do aluguel mensal de {{ALUGUEL_VALOR}} já contempla o IPTU do IMÓVEL, ficando o LOCADOR responsável pelo seu recolhimento direto à municipalidade.

Parágrafo único. Eventual cobrança suplementar, retroativa, revisão ou diferença de IPTU lançada pela municipalidade será de responsabilidade exclusiva do LOCADOR, não podendo ser repassada ao LOCATÁRIO, salvo quanto a multas e juros decorrentes de atraso atribuível ao LOCATÁRIO em comunicar fatos que impactem o lançamento.`,
  },

  // ALUGUEL INCLUI CONDOMÍNIO
  {
    tipo: 'adicional', categoria: 'aluguel_inclui', titulo: 'Condomínio incluso no aluguel', numero: 17,
    corpo: `Para a presente locação, o valor do aluguel mensal de {{ALUGUEL_VALOR}} já contempla a taxa de condomínio ordinária do IMÓVEL, ficando o LOCADOR responsável pelo pagamento mensal direto ao condomínio.

Parágrafo primeiro. Despesas extraordinárias do condomínio (obras, reformas, fundo de reserva extraordinário) seguem o regime legal da Lei nº 8.245/1991 — não estão inclusas no aluguel.

Parágrafo segundo. Multas condominiais decorrentes de conduta do LOCATÁRIO, ocupantes, visitantes ou animais permanecem de responsabilidade exclusiva do LOCATÁRIO.`,
  },

  // SAÍDA SEM MULTA APÓS 12 MESES
  {
    tipo: 'adicional', categoria: 'rescisao', titulo: 'Saída sem multa após 12 meses', numero: 18,
    corpo: `Fica expressamente convencionado entre as partes que, após o cumprimento mínimo de 12 (doze) meses completos de locação, o LOCATÁRIO poderá rescindir antecipadamente o presente contrato SEM incidência da multa rescisória de 3 (três) aluguéis prevista na cláusula de rescisão antecipada.

Parágrafo primeiro. A dispensa da multa rescisória após 12 meses fica condicionada a:
I. comunicação por escrito ao LOCADOR/ADMINISTRADORA com antecedência mínima de 30 (trinta) dias;
II. pagamento integral de aluguéis, IPTU, consumos, encargos, multas e demais obrigações até a efetiva entrega das chaves;
III. devolução do IMÓVEL nas condições descritas na vistoria inicial, ressalvado o desgaste natural decorrente do uso regular.

Parágrafo segundo. Antes de completar 12 meses, mantém-se integralmente a multa rescisória proporcional prevista no contrato.

Parágrafo terceiro. A dispensa da multa rescisória não exonera o LOCATÁRIO das demais obrigações de devolução regular do IMÓVEL.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  ADMINISTRAÇÃO IMOBILIÁRIA — contrato entre proprietário e admin
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'administracao', categoria: 'partes', titulo: 'Das partes', numero: 1,
    corpo: `CONTRATANTE / PROPRIETÁRIO: {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, {{LOCADOR_PROFISSAO}}, portador(a) do CPF nº {{LOCADOR_CPF}} e RG {{LOCADOR_RG}}, residente e domiciliado(a) em {{LOCADOR_ENDERECO}}, doravante denominado(a) simplesmente CONTRATANTE.

CONTRATADA / ADMINISTRADORA: {{ADMIN_RAZAO_SOCIAL}}, pessoa jurídica de direito privado, inscrita no CNPJ nº {{ADMIN_CNPJ}}, CRECI Jurídico {{ADMIN_CRECI_J}}, com sede em {{ADMIN_ENDERECO}}, neste ato representada por {{ADMIN_RESPONSAVEL}}, corretor(a) de imóveis, CRECI {{ADMIN_RESPONSAVEL_CRECI}}, doravante denominada simplesmente ADMINISTRADORA.

As partes ajustam o presente CONTRATO DE ADMINISTRAÇÃO IMOBILIÁRIA, regido pela Lei nº 8.245/1991, pelo Código Civil, pelo Código de Defesa do Consumidor quando aplicável e pelas cláusulas seguintes.`,
  },

  {
    tipo: 'administracao', categoria: 'objeto', titulo: 'Do objeto', numero: 2,
    corpo: `O presente contrato tem por objeto a prestação de serviços de administração imobiliária pela ADMINISTRADORA sobre o imóvel de propriedade do CONTRATANTE situado em {{IMOVEL_ENDERECO}}, CEP {{IMOVEL_CEP}}, doravante denominado simplesmente IMÓVEL.

Parágrafo primeiro. A administração compreende, sem se limitar a: divulgação, captação de inquilinos, análise cadastral, intermediação de locação, elaboração de contratos, vistorias inicial e final, entrega/recebimento de chaves, cobrança mensal de aluguel e encargos, repasse ao CONTRATANTE, gestão de inadimplência, comunicações com inquilinos, condomínios, prestadores e órgãos públicos.

Parágrafo segundo. {{ADM_EXCLUSIVIDADE}}, sendo vedada ao CONTRATANTE a captação direta ou através de terceiros enquanto vigente este contrato.`,
  },

  {
    tipo: 'administracao', categoria: 'prazo', titulo: 'Do prazo e renovação', numero: 3,
    corpo: `O presente contrato tem prazo de {{ADM_PRAZO_MESES}} (doze) meses, com início em {{ADM_DATA_INICIO}} e término em {{ADM_DATA_TERMINO}}.

Parágrafo primeiro. Findo o prazo, o contrato será renovado automaticamente por iguais períodos sucessivos, salvo manifestação contrária por escrito de qualquer das partes com antecedência mínima de {{ADM_AVISO_PREVIO_DIAS}} (trinta) dias do término.

Parágrafo segundo. A vigência da administração subsiste mesmo após o término do contrato de locação atualmente vigente, podendo a ADMINISTRADORA buscar novo inquilino para o IMÓVEL.`,
  },

  {
    tipo: 'administracao', categoria: 'taxa', titulo: 'Da taxa de administração', numero: 4,
    corpo: `O CONTRATANTE remunerará a ADMINISTRADORA com taxa equivalente a {{ADM_TAXA_DESCRICAO}}, devida mensalmente sobre o aluguel efetivamente recebido.

Parágrafo primeiro. A primeira parcela do aluguel poderá ser destinada integralmente à ADMINISTRADORA como comissão de intermediação locatícia, conforme uso e costume do mercado imobiliário, se assim ajustado em parágrafo específico.

Parágrafo segundo. A taxa será descontada automaticamente do valor recebido antes do repasse ao CONTRATANTE, sendo demonstrada em extrato mensal disponível ao CONTRATANTE.

Parágrafo terceiro. A taxa não incide sobre IPTU, condomínio, seguros, multas, indenizações por danos, reembolsos e demais valores que não constituam aluguel propriamente dito.`,
  },

  {
    tipo: 'administracao', categoria: 'repasse', titulo: 'Do repasse ao proprietário', numero: 5,
    corpo: `O repasse mensal do aluguel recebido, deduzidas a taxa de administração e demais encargos legítimos, será efetuado ao CONTRATANTE até o dia {{ADM_DIA_REPASSE}} de cada mês, mediante crédito em conta bancária ou chave PIX informada pelo CONTRATANTE.

Parágrafo primeiro. Caso o aluguel não seja recebido até a data de repasse, a ADMINISTRADORA fica desobrigada de efetuá-lo até o efetivo pagamento pelo inquilino, sem que isso configure inadimplemento de sua parte.

Parágrafo segundo. Eventuais despesas necessárias e autorizadas pelo CONTRATANTE (pequenos reparos, taxas administrativas, despesas de cobrança) serão deduzidas do repasse, com apresentação de comprovantes.

Parágrafo terceiro. O CONTRATANTE compromete-se a manter atualizados seus dados bancários junto à ADMINISTRADORA. Eventual atraso no repasse por desatualização cadastral ou erro nos dados fornecidos não configura mora da ADMINISTRADORA.`,
  },

  {
    tipo: 'administracao', categoria: 'obrigacoes_adm', titulo: 'Das obrigações da administradora', numero: 6,
    corpo: `Compete à ADMINISTRADORA, no exercício de seu mandato:
I. anunciar o IMÓVEL nos canais adequados;
II. analisar candidatos a inquilino, verificar referências e idoneidade financeira;
III. elaborar contrato de locação, vistorias e termos correlatos;
IV. promover entrega e recebimento de chaves;
V. emitir cobranças mensais, recibos e comunicações ao inquilino;
VI. realizar gestão de inadimplência: cobrança extrajudicial, acordo, protesto, negativação e ação judicial quando autorizada;
VII. prestar contas ao CONTRATANTE mediante demonstrativo mensal;
VIII. comunicar ao CONTRATANTE fatos relevantes (sinistros, ações judiciais, propostas, ofertas de compra, vistorias);
IX. zelar pela conservação do IMÓVEL nas vistorias periódicas e finais;
X. manter sigilo de dados do CONTRATANTE e do inquilino, observando a Lei Geral de Proteção de Dados.`,
  },

  {
    tipo: 'administracao', categoria: 'obrigacoes_contratante', titulo: 'Das obrigações do contratante', numero: 7,
    corpo: `Compete ao CONTRATANTE:
I. entregar o IMÓVEL apto à locação, com documentação regularizada (matrícula, IPTU, ligações de água/luz);
II. autorizar expressamente a ADMINISTRADORA a representá-lo em todos os atos da locação;
III. comunicar imediatamente à ADMINISTRADORA: venda, oneração, decisão judicial, mudança de estado civil, falecimento ou outro fato que afete a administração;
IV. manter atualizados seus dados pessoais, bancários e de contato;
V. responder por vícios estruturais, defeitos ocultos e reparos extraordinários do IMÓVEL;
VI. arcar com IPTU, taxas, contribuições, despesas extraordinárias do condomínio e demais obrigações inerentes à propriedade;
VII. respeitar o regime de exclusividade pactuado, abstendo-se de captar inquilino diretamente.`,
  },

  {
    tipo: 'administracao', categoria: 'rescisao', titulo: 'Da rescisão', numero: 8,
    corpo: `O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de {{ADM_AVISO_PREVIO_DIAS}} (trinta) dias, sem incidência de multa, desde que respeitadas as obrigações pendentes e a continuidade do contrato de locação vigente até o seu termo natural.

Parágrafo primeiro. Em caso de rescisão por iniciativa do CONTRATANTE durante o prazo contratual e sem motivo justificado, será devida multa equivalente a {{ADM_MULTA_MESES}} (três) meses de taxa de administração calculada sobre o aluguel vigente.

Parágrafo segundo. A rescisão imotivada não afasta a obrigação do CONTRATANTE de respeitar o contrato de locação vigente firmado pela ADMINISTRADORA com o inquilino, sob pena de responder por perdas e danos.

Parágrafo terceiro. Configurarão justa causa pra rescisão sem multa: descumprimento reiterado de obrigações; falência ou insolvência da ADMINISTRADORA; perda do CRECI; conduta lesiva aos interesses do CONTRATANTE.`,
  },

  {
    tipo: 'administracao', categoria: 'comunicacoes', titulo: 'Das comunicações e LGPD', numero: 9,
    corpo: `As comunicações entre as partes ocorrerão preferencialmente por escrito, inclusive WhatsApp, e-mail, plataforma digital ou notificação extrajudicial, ficando válidas quando comprovado envio ou recebimento.

Parágrafo único. As partes consentem com o tratamento de dados pessoais necessários à execução deste contrato, nos termos da Lei nº 13.709/2018, comprometendo-se com a guarda, sigilo e uso adequado das informações, observadas as finalidades pactuadas.`,
  },

  {
    tipo: 'administracao', categoria: 'foro', titulo: 'Do foro', numero: 10,
    corpo: `Fica eleito o foro da Comarca de Cuiabá-MT para dirimir quaisquer dúvidas ou controvérsias decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

E, por estarem justos e contratados, plenamente cientes da seriedade das obrigações assumidas, assinam o presente instrumento digitalmente, em vias de igual teor, juntamente com 02 (duas) testemunhas.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  FUNDAMENTAÇÃO LEGAL (Lei 8.245/91) — vai antes das partes
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'fundamentacao', categoria: 'fundamentacao', titulo: 'Da fundamentação legal', numero: 1,
    corpo: `As partes ajustam o presente contrato de locação com fundamento na Lei nº 8.245/1991 (Lei do Inquilinato), especialmente quanto aos deveres do locador e do locatário, às garantias locatícias, à conservação do imóvel, ao pagamento dos encargos, ao direito de preferência, à rescisão, à multa proporcional e às demais disposições aplicáveis à locação de imóvel urbano residencial.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  ATUAÇÃO — variantes da cláusula "Das partes"
  //  (auto-inject escolhe UMA conforme contratos.tipo_atuacao)
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'atuacao', categoria: 'partes', titulo: 'Das partes (intermediação)', numero: 1,
    corpo: `LOCADOR / PROPRIETÁRIO: {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, {{LOCADOR_PROFISSAO}}, portador(a) do CPF nº {{LOCADOR_CPF}} e RG {{LOCADOR_RG}}, residente e domiciliado(a) em {{LOCADOR_ENDERECO}}, doravante denominado(a) simplesmente LOCADOR.

INTERMEDIADOR(A): {{ADMIN_RAZAO_SOCIAL}}, inscrita no CNPJ nº {{ADMIN_CNPJ}}, CRECI Jurídico {{ADMIN_CRECI_J}}, com endereço profissional em {{ADMIN_ENDERECO}}, neste ato representada por {{ADMIN_RESPONSAVEL}}, corretor(a) de imóveis, CRECI {{ADMIN_RESPONSAVEL_CRECI}}, participou exclusivamente da intermediação da presente locação, não assumindo a administração do imóvel, a cobrança de aluguéis, a gestão de reparos, a prestação de contas ou a representação do LOCADOR, salvo disposição expressa em contrato próprio.

LOCATÁRIO: {{LOCATARIO_NOME}}, {{LOCATARIO_NACIONALIDADE}}, {{LOCATARIO_ESTADO_CIVIL}}, {{LOCATARIO_PROFISSAO}}, nascido(a) em {{LOCATARIO_DATA_NASC}}, natural de {{LOCATARIO_NATURALIDADE}}, portador(a) do RG {{LOCATARIO_RG}} e CPF nº {{LOCATARIO_CPF}}, filho(a) de {{LOCATARIO_NOME_PAI}} e {{LOCATARIO_NOME_MAE}}, residente e domiciliado(a) em {{LOCATARIO_ENDERECO}}, doravante denominado(a) LOCATÁRIO.

As partes ajustam o presente CONTRATO DE LOCAÇÃO RESIDENCIAL, regido pela Lei nº 8.245/1991, pelo Código Civil e pelas cláusulas a seguir. Fica expressamente ajustado que a presente locação foi apenas intermediada por {{ADMIN_RAZAO_SOCIAL}}, não havendo administração imobiliária continuada, salvo contratação específica em instrumento próprio. Após a assinatura deste contrato e entrega das chaves, as obrigações de cobrança, recebimento, manutenção, notificações, reajustes, tratativas e encerramento da locação serão realizadas diretamente entre LOCADOR e LOCATÁRIO, ou por terceiro formalmente autorizado.`,
  },

  {
    tipo: 'atuacao', categoria: 'partes', titulo: 'Das partes (locação direta)', numero: 2,
    corpo: `LOCADOR / PROPRIETÁRIO: {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, {{LOCADOR_PROFISSAO}}, portador(a) do CPF nº {{LOCADOR_CPF}} e RG {{LOCADOR_RG}}, residente e domiciliado(a) em {{LOCADOR_ENDERECO}}, doravante denominado(a) simplesmente LOCADOR.

LOCATÁRIO: {{LOCATARIO_NOME}}, {{LOCATARIO_NACIONALIDADE}}, {{LOCATARIO_ESTADO_CIVIL}}, {{LOCATARIO_PROFISSAO}}, nascido(a) em {{LOCATARIO_DATA_NASC}}, natural de {{LOCATARIO_NATURALIDADE}}, portador(a) do RG {{LOCATARIO_RG}} e CPF nº {{LOCATARIO_CPF}}, filho(a) de {{LOCATARIO_NOME_PAI}} e {{LOCATARIO_NOME_MAE}}, residente e domiciliado(a) em {{LOCATARIO_ENDERECO}}, doravante denominado(a) LOCATÁRIO.

As partes ajustam o presente CONTRATO DE LOCAÇÃO RESIDENCIAL, celebrado diretamente entre LOCADOR e LOCATÁRIO, sem intermediação de corretor ou administradora, regido pela Lei nº 8.245/1991, pelo Código Civil e pelas cláusulas a seguir. As obrigações de cobrança, recebimento, manutenção, notificações, reajustes, tratativas e encerramento da locação serão realizadas diretamente entre as partes, ou por terceiro formalmente autorizado.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  MOBÍLIA — 4 variantes + cláusula genérica de inventário
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'mobilia', categoria: 'mobilia', titulo: 'Da mobília — imóvel sem mobília', numero: 1,
    corpo: `O imóvel é entregue sem mobília, salvo itens fixos eventualmente descritos no laudo de vistoria inicial, tais como armários planejados, luminárias, box, espelhos, cortinas, cooktop, forno embutido, ar-condicionado ou outros bens incorporados ou existentes no imóvel.`,
  },

  {
    tipo: 'mobilia', categoria: 'mobilia', titulo: 'Da mobília — imóvel semi-mobiliado', numero: 2,
    corpo: `O imóvel é entregue semi-mobiliado, contendo os bens, móveis, eletrodomésticos, armários, equipamentos e utensílios descritos no laudo de vistoria inicial/inventário de bens, que passa a integrar este contrato.`,
  },

  {
    tipo: 'mobilia', categoria: 'mobilia', titulo: 'Da mobília — imóvel parcialmente mobiliado', numero: 3,
    corpo: `O imóvel é entregue parcialmente mobiliado, apenas com os itens expressamente descritos no inventário de bens anexo, não se presumindo a existência de outros móveis, eletrodomésticos ou utensílios além daqueles listados e fotografados.`,
  },

  {
    tipo: 'mobilia', categoria: 'mobilia', titulo: 'Da mobília — imóvel 100% mobiliado', numero: 4,
    corpo: `O imóvel é entregue 100% mobiliado, com móveis, eletrodomésticos, eletrônicos, utensílios, equipamentos, armários, luminárias, cortinas, itens decorativos e demais bens descritos no inventário de bens e no laudo de vistoria inicial, os quais integram este contrato para todos os fins.`,
  },

  {
    tipo: 'mobilia', categoria: 'mobilia', titulo: 'Inventário de bens e responsabilidade', numero: 5,
    corpo: `Os bens móveis, eletrodomésticos, eletrônicos, utensílios, equipamentos, armários e demais itens existentes no imóvel deverão ser descritos em inventário próprio, com indicação de quantidade, marca, modelo, cor, estado de conservação, funcionamento e registro fotográfico sempre que possível.

Parágrafo primeiro. Os LOCATÁRIOS declaram receber os bens no estado indicado no laudo de vistoria inicial e obrigam-se a conservá-los e devolvê-los no mesmo estado, ressalvado o desgaste natural decorrente do uso regular.

Parágrafo segundo. É vedado aos LOCATÁRIOS remover, vender, doar, emprestar, substituir, desmontar, descartar, transportar para outro local ou alterar os bens do imóvel sem autorização prévia e escrita do LOCADOR ou da ADMINISTRADORA, quando houver.

Parágrafo terceiro. Em caso de quebra, perda, extravio, dano, mau uso, inutilização, substituição indevida ou ausência de devolução de qualquer item, os LOCATÁRIOS deverão reparar, substituir por bem equivalente ou indenizar o LOCADOR pelo valor de reposição.

Parágrafo quarto. Na vistoria final, os bens serão conferidos item por item, com base no inventário inicial. A devolução do imóvel somente será considerada regular após a conferência do imóvel e dos bens inventariados.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  PET — 4 variantes + cláusula de limpeza/devolução
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'pet', categoria: 'pet', titulo: 'Da política de pet — não aceita', numero: 1,
    corpo: `Os LOCATÁRIOS declaram ciência de que o LOCADOR não autoriza, por condição contratual específica desta locação, a permanência de animais domésticos no imóvel sem autorização prévia e escrita.

Parágrafo único. Eventual permanência de animal sem autorização poderá caracterizar infração contratual, especialmente se houver danos ao imóvel, perturbação ao sossego, risco à segurança, problema de higiene, descumprimento de normas condominiais ou prejuízo a terceiros.`,
  },

  {
    tipo: 'pet', categoria: 'pet', titulo: 'Da política de pet — aceita', numero: 2,
    corpo: `Fica permitida a permanência de animal doméstico no imóvel, desde que respeitadas as normas legais, contratuais e condominiais, bem como as regras de higiene, segurança, sossego, salubridade, circulação em áreas comuns e boa vizinhança.

Parágrafo primeiro. Os LOCATÁRIOS serão integralmente responsáveis por danos, sujeira excessiva, odores, barulhos, riscos, mordidas, arranhões, infestação de pulgas/carrapatos, danos a móveis, portas, pisos, rodapés, telas, pintura, cortinas, estofados, jardins, áreas comuns ou quaisquer prejuízos causados pelo animal.

Parágrafo segundo. Os LOCATÁRIOS deverão manter o animal em condições adequadas de higiene, vacinação, segurança e controle, respondendo por multas condominiais, reclamações formais, danos a terceiros e despesas decorrentes da permanência do animal.

Parágrafo terceiro. Se o animal causar prejuízo ao sossego, segurança, saúde, higiene ou conservação do imóvel, o LOCADOR ou a ADMINISTRADORA poderá exigir providências corretivas, reparos, indenizações ou, em casos graves e persistentes, a retirada do animal, respeitados os meios legais cabíveis.`,
  },

  {
    tipo: 'pet', categoria: 'pet', titulo: 'Da política de pet — somente com autorização', numero: 3,
    corpo: `A permanência de animal doméstico no imóvel dependerá de autorização prévia e escrita do LOCADOR ou da ADMINISTRADORA, quando houver, devendo o LOCATÁRIO informar espécie, porte, quantidade, características do animal e assumir responsabilidade integral por danos, higiene, segurança, sossego e normas condominiais.

Parágrafo único. Concedida a autorização, os LOCATÁRIOS responderão por todos os prejuízos causados pelo animal, incluindo danos ao imóvel, multas condominiais, reclamações formais e despesas de higienização ao final da locação.`,
  },

  {
    tipo: 'pet', categoria: 'pet', titulo: 'Da política de pet — conforme condomínio', numero: 4,
    corpo: `A permanência de animal doméstico observará as regras da convenção, regimento interno e normas administrativas do condomínio, bem como os limites de segurança, sossego, higiene, salubridade e boa convivência.

Parágrafo único. O LOCATÁRIO responderá integralmente por danos, multas condominiais, reclamações formais e despesas causadas pelo animal, bem como pelo cumprimento das normas condominiais aplicáveis à manutenção e circulação do pet em áreas comuns.`,
  },

  {
    tipo: 'pet', categoria: 'pet', titulo: 'Limpeza, desinfecção e devolução (com pet)', numero: 5,
    corpo: `Havendo permanência de animal doméstico no imóvel, os LOCATÁRIOS obrigam-se, ao final da locação, a devolver o imóvel limpo, higienizado, livre de odores, pelos, resíduos, pulgas, carrapatos, danos em portas, pisos, rodapés, telas, estofados, móveis, jardins e demais itens, respondendo por limpeza especializada, dedetização, higienização, reparos ou indenizações quando constatada necessidade na vistoria final.

Parágrafo único. Em imóvel mobiliado, semi-mobiliado ou parcialmente mobiliado, os LOCATÁRIOS responderão também por danos, odores, manchas, rasgos, arranhões, pelos impregnados ou deteriorações causadas pelo animal em sofás, colchões, camas, cortinas, tapetes, cadeiras, móveis, eletrodomésticos e demais bens inventariados.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  ALUGUEL PACOTE — variantes quando o aluguel inclui encargos
  //  (auto-inject usa em vez da cláusula 7/16 padrão se ENCARGOS_INCLUSOS
  //  tiver algum item)
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'aluguel_pacote', categoria: 'aluguel', titulo: 'Aluguel pacote — valor e encargos', numero: 1,
    corpo: `O aluguel mensal ajustado é de {{ALUGUEL_VALOR}} ({{ALUGUEL_EXTENSO}}), com vencimento todo dia {{VENCIMENTO_DIA}} de cada mês, em regime de pacote único.

Parágrafo primeiro. O valor mensal pactuado já inclui, sem cobrança à parte: {{ENCARGOS_INCLUSOS}}.

Parágrafo segundo. Continuam de responsabilidade do LOCATÁRIO, quando aplicáveis e cobrados separadamente: {{ENCARGOS_SEPARADOS}}, além de multas condominiais causadas pelo LOCATÁRIO, ocupantes, visitantes ou terceiros sob sua responsabilidade.

Parágrafo terceiro. O pagamento deverá ser realizado por PIX, transferência, boleto ou outro meio informado por escrito pela ADMINISTRADORA ou pelo LOCADOR.

Parágrafo quarto. O não recebimento de boleto, mensagem, aviso ou cobrança não isenta o LOCATÁRIO do pagamento pontual, cabendo-lhe solicitar a segunda via ou os dados de pagamento antes do vencimento.

Parágrafo quinto. Pagamentos parciais, tolerâncias, atrasos aceitos, acordos pontuais ou recebimentos fora do prazo não caracterizam novação, renúncia de direito, perdão de dívida ou alteração definitiva das condições deste contrato.

Parágrafo sexto. Eventual reajuste de IPTU, taxa condominial ordinária, contribuições, despesas extraordinárias ou consumos individualizados poderá ensejar revisão do pacote, mediante aviso prévio mínimo de 30 (trinta) dias, sem prejuízo da cláusula de reajuste anual.`,
  },

  {
    tipo: 'aluguel_pacote', categoria: 'obrigacoes_loc', titulo: 'Obrigações do locatário (aluguel pacote)', numero: 2,
    corpo: `Além das demais obrigações previstas neste contrato e na lei, o LOCATÁRIO obriga-se a:
I. pagar pontualmente o valor mensal do pacote ({{ALUGUEL_VALOR}}), bem como os encargos cobrados à parte ({{ENCARGOS_SEPARADOS}}), seguros, multas e demais despesas sob sua responsabilidade;
II. usar o IMÓVEL exclusivamente para moradia residencial, preservando vizinhança, sossego, segurança e normas locais;
III. conservar o IMÓVEL como se seu fosse, evitando deterioração, sujeira excessiva, danos e uso incompatível;
IV. não transferir, emprestar, sublocar, ceder ou permitir uso por terceiros sem autorização expressa;
V. não realizar obras, alterações, pinturas ou instalações fixas sem autorização escrita;
VI. comunicar imediatamente danos, defeitos, infiltrações, vazamentos, notificações, multas, cobranças e intimações;
VII. pagar multas decorrentes de sua conduta, de seus ocupantes, visitantes, animais ou prestadores de serviço;
VIII. manter contas dos consumos individuais ({{ENCARGOS_SEPARADOS}}) em dia e apresentar comprovantes quando solicitados;
IX. permitir vistorias e visitas conforme previsto neste contrato;
X. devolver o IMÓVEL livre de pessoas e bens, limpo, com chaves, controles, acessos e encargos quitados, observando que o pacote mensal não dispensa a quitação de débitos individualizados eventualmente existentes.`,
  },

  // ════════════════════════════════════════════════════════════════
  //  ALUGUEL PACOTE — variante específica: IPTU e condomínio inclusos
  //  (texto mais natural pro caso mais comum no mercado de Cuiabá)
  // ════════════════════════════════════════════════════════════════

  {
    tipo: 'aluguel_pacote', categoria: 'aluguel', titulo: 'Aluguel pacote — IPTU e condomínio inclusos', numero: 3,
    corpo: `O aluguel mensal ajustado é de {{ALUGUEL_VALOR}} ({{ALUGUEL_EXTENSO}}), com vencimento todo dia {{VENCIMENTO_DIA}} de cada mês. O valor mensal já contempla o IPTU e o condomínio ordinário, que ficam embutidos no pacote, sem cobrança em separado.

Parágrafo primeiro. Como o valor mensal já inclui IPTU e condomínio ordinário, ficam de responsabilidade do LOCATÁRIO os seguintes encargos, quando aplicáveis, cobrados separadamente:
I. água;
II. energia elétrica;
III. gás;
IV. internet;
V. seguro incêndio;
VI. seguro-fiança, quando essa for a modalidade de garantia;
VII. multas condominiais causadas pelo LOCATÁRIO, ocupantes, visitantes ou terceiros sob sua responsabilidade;
VIII. despesas extraordinárias do condomínio, quando devidas conforme legislação;
IX. demais despesas vinculadas ao uso do imóvel não compreendidas no pacote.

Parágrafo segundo. O valor mensal total a ser pago pelo LOCATÁRIO é de {{ALUGUEL_VALOR}}, já considerando aluguel, IPTU e condomínio ordinário em pacote único.

Parágrafo terceiro. O pagamento deverá ser realizado por PIX, transferência, boleto ou outro meio informado por escrito pela ADMINISTRADORA ou pelo LOCADOR.

Parágrafo quarto. O não recebimento de boleto, mensagem, aviso ou cobrança não isenta o LOCATÁRIO do pagamento pontual, cabendo-lhe solicitar a segunda via ou os dados de pagamento antes do vencimento.

Parágrafo quinto. Eventual reajuste relevante do IPTU ou da taxa condominial ordinária, contribuições especiais, despesas extraordinárias ou consumos individualizados poderá ensejar revisão do pacote, mediante aviso prévio mínimo de 30 (trinta) dias, sem prejuízo da cláusula anual de reajuste.

Parágrafo sexto. Pagamentos parciais, tolerâncias, atrasos aceitos, acordos pontuais ou recebimentos fora do prazo não caracterizam novação, renúncia de direito, perdão de dívida ou alteração definitiva das condições deste contrato.`,
  },

  {
    tipo: 'aluguel_pacote', categoria: 'obrigacoes_loc', titulo: 'Obrigações do locatário (pacote IPTU + condomínio)', numero: 4,
    corpo: `Além das demais obrigações previstas neste contrato e na lei, o LOCATÁRIO obriga-se a:
I. pagar pontualmente o valor mensal do pacote ({{ALUGUEL_VALOR}}), que já contempla aluguel, IPTU e condomínio ordinário, bem como os encargos cobrados à parte (água, energia elétrica, gás, internet, seguros), multas e demais despesas sob sua responsabilidade;
II. usar o IMÓVEL exclusivamente para moradia residencial, preservando vizinhança, sossego, segurança e normas locais;
III. conservar o IMÓVEL como se seu fosse, evitando deterioração, sujeira excessiva, danos e uso incompatível;
IV. não transferir, emprestar, sublocar, ceder ou permitir uso por terceiros sem autorização expressa;
V. não realizar obras, alterações, pinturas ou instalações fixas sem autorização escrita;
VI. comunicar imediatamente danos, defeitos, infiltrações, vazamentos, notificações, multas, cobranças e intimações;
VII. pagar multas decorrentes de sua conduta, de seus ocupantes, visitantes, animais ou prestadores de serviço;
VIII. manter contas individualizadas de água, energia, gás e internet em dia e apresentar comprovantes quando solicitados;
IX. permitir vistorias e visitas conforme previsto neste contrato;
X. devolver o IMÓVEL livre de pessoas e bens, limpo, com chaves, controles, acessos e encargos quitados, observando que o pacote mensal não dispensa a quitação de débitos individualizados eventualmente existentes.`,
  },
]
