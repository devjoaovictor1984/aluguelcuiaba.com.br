import { FlaskConical, Radio } from 'lucide-react'
import { ambienteMaximiza } from '@/lib/seguros/maximiza/client'
import { simuladorAtivo } from '@/lib/seguros/maximiza/simulador'

/**
 * Em que ambiente da corretora esta tela está falando.
 *
 * Por que existe: a URL da Maximiza é a MESMA nos dois ambientes. Trocar
 * `MAXIMIZA_AMBIENTE` de 2 para 1 não muda nada de visível — as telas
 * ficam idênticas, os botões no mesmo lugar, e o "Contratar seguro" passa
 * a emitir apólice de verdade sem nenhum aviso. Quem abriu a aba de manhã
 * em homologação e voltou nela depois de um deploy não tem como saber.
 *
 * Também diz sob QUAL CNPJ a cotação sai. Em homologação isso não é óbvio:
 * `cnpjParaHomologacao()` usa o CNPJ do corretor quando ele já responde na
 * base da corretora e cai no CNPJ de teste quando não responde — e as duas
 * cotações são indistinguíveis na tela.
 *
 * Não aparece no modo demonstração — lá o `AvisoDemo` já diz o que
 * importa, e duas faixas dizendo coisas parecidas não somam.
 */
export function FaixaAmbiente() {
  let ambiente: 1 | 2
  try {
    if (simuladorAtivo()) return null
    ambiente = ambienteMaximiza()
  } catch {
    // Env var ausente ou demo+produção: quem trata é a chamada, que falha
    // com mensagem própria. Uma faixa a menos não piora nada.
    return null
  }

  if (ambiente === 1) {
    return (
      <div className="rounded-xl bg-red-50 ring-1 ring-red-300 px-3.5 py-2.5 flex items-start gap-2">
        <Radio size={14} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-red-900 leading-snug">
          <strong>Produção.</strong> Apólice contratada aqui é real: gera
          cobrança ao cliente, comissão e cancelamento com prazo. O cálculo
          continua sendo só consulta — quem emite é o botão de contratar.
        </p>
      </div>
    )
  }

  const cnpj = (process.env.MAXIMIZA_CNPJ_TESTE ?? '').replace(/\D/g, '')
  const cnpjFmt = cnpj.length === 14
    ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  return (
    <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-2.5 flex items-start gap-2">
      <FlaskConical size={14} className="text-slate-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-slate-700 leading-snug">
        <strong>Homologação.</strong> Nenhuma apólice daqui é real. A cotação
        sai sob o seu CNPJ quando ele já responde na base da corretora
        {cnpjFmt && (
          <>; se não responder, cai no CNPJ de teste
            {' '}<span className="font-mono">{cnpjFmt}</span>
          </>
        )}.
      </p>
    </div>
  )
}
