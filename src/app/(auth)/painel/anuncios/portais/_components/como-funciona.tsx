import { ChevronDown, HelpCircle } from 'lucide-react'

/**
 * Explicação do feed para o anunciante, na própria tela de Portais.
 * Abre sozinha enquanto a URL do feed não foi gerada (primeira configuração).
 * Texto espelha docs/integracoes/portais/README.md — mudou lá, muda aqui.
 */
export function ComoFunciona({ aberto }: { aberto: boolean }) {
  return (
    <details open={aberto} className="group bg-violet-50/60 ring-1 ring-violet-100 rounded-2xl mb-5 text-sm text-gray-700">
      <summary className="flex items-center gap-2 cursor-pointer select-none px-4 py-3 font-semibold text-violet-900 list-none [&::-webkit-details-marker]:hidden">
        <HelpCircle size={16} className="text-violet-600" />
        Como funciona
        <ChevronDown size={16} className="ml-auto text-violet-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-4 pb-4 space-y-4">
        <p>
          Você não envia nada para o portal: o site deixa a lista dos seus anúncios num endereço
          (a <strong>URL do feed</strong>) e o portal <strong>vem buscar sozinho</strong>, algumas vezes por dia.
          Um endereço só atende OLX, ZAP Imóveis e Viva Real (são do mesmo grupo).
        </p>

        <div>
          <p className="font-semibold text-gray-900 mb-1.5">Configurar (uma vez só)</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Tenha um <strong>plano no Canal Pro</strong> (a área de anunciante do Grupo OLX). É contratado direto com eles.</li>
            <li>Aqui embaixo, clique em <strong>Gerar URL do feed</strong> e copie o endereço.</li>
            <li>Passe a URL ao seu gerente ou ao suporte do Canal Pro, pedindo <em>integração por feed XML (VRSync)</em>.</li>
            <li>Ligue os anúncios que devem ir para os portais.</li>
          </ol>
        </div>

        <div>
          <p className="font-semibold text-gray-900 mb-1.5">Depois é automático</p>
          <ul className="space-y-0.5">
            <li>Ligou o anúncio → <strong>publica</strong></li>
            <li>Mudou preço, texto ou fotos → <strong>atualiza</strong></li>
            <li>Pausou, alugou, venceu ou desligou → <strong>sai do ar</strong></li>
          </ul>
          <p className="text-xs text-gray-500 mt-1.5">
            Leva algumas horas, porque o portal decide quando vem buscar. Edite sempre aqui: o que for mudado
            direto no portal pode ser desfeito na próxima leitura.
          </p>
        </div>

        <div>
          <p className="font-semibold text-gray-900 mb-1.5">Bom saber</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>O portal exige <strong>5 fotos JPG, CEP, área e valor</strong>. O que faltar aparece em vermelho no anúncio.</li>
            <li>O portal mostra só o <strong>bairro</strong>; rua e número servem só para o mapa.</li>
            <li>Destaque e Super destaque só valem se o seu plano no Canal Pro incluir.</li>
            <li>Quando aparecer <strong>Última leitura</strong>, o portal já está buscando.</li>
            <li>A URL funciona como senha. Se vazar, use <strong>Trocar URL</strong> e passe a nova ao Canal Pro.</li>
            <li>Os contatos dos interessados chegam pelo portal (e-mail/WhatsApp cadastrados lá).</li>
          </ul>
        </div>

        <div className="bg-white/70 rounded-xl ring-1 ring-violet-100 px-3 py-2.5">
          <p className="font-semibold text-gray-900">Já tenho anúncios cadastrados no OLX/ZAP</p>
          <p className="mt-0.5">
            O feed vai <strong>daqui para lá</strong>; o site não puxa os anúncios que já estão no portal.
            Cadastre aqui os imóveis que quer manter e, antes de ligar o feed, pergunte ao gerente do Canal Pro
            como ficam os anúncios feitos à mão: em geral a integração passa a mandar e eles podem ser
            substituídos ou duplicados.
          </p>
        </div>
      </div>
    </details>
  )
}
