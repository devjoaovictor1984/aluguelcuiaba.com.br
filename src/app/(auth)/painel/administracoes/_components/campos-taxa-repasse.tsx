'use client'

/**
 * Base da taxa, prazo do repasse e limite de reparo urgente (v105).
 * O modelo de administração deixava os três em colchetes pra completar à
 * mão em cada contrato; agora saem destes campos.
 */
export function CamposTaxaRepasse({
  taxaTipo, taxaBase, setTaxaBase, repasseDias, setRepasseDias, limiteReparos, setLimiteReparos, inputCls,
}: {
  taxaTipo: 'percentual' | 'fixo'
  taxaBase: 'aluguel' | 'aluguel_encargos'
  setTaxaBase: (v: 'aluguel' | 'aluguel_encargos') => void
  repasseDias: string
  setRepasseDias: (v: string) => void
  limiteReparos: string
  setLimiteReparos: (v: string) => void
  inputCls: string
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">Taxa incide sobre</span>
        <select
          value={taxaBase}
          onChange={e => setTaxaBase(e.target.value as 'aluguel' | 'aluguel_encargos')}
          disabled={taxaTipo === 'fixo'}
          className={inputCls}
        >
          <option value="aluguel">Só o aluguel-base</option>
          <option value="aluguel_encargos">Aluguel + condomínio + IPTU</option>
        </select>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {taxaTipo === 'fixo' ? 'Taxa fixa não tem base de cálculo.' : 'Seguros e consumos nunca entram na base.'}
        </p>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">Repasse em até (dias úteis)</span>
        <input type="number" min={1} max={30} value={repasseDias} onChange={e => setRepasseDias(e.target.value)} className={inputCls} />
        <p className="text-[10px] text-gray-400 mt-0.5">Contados da compensação do pagamento do locatário.</p>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">Reparo urgente sem autorização até (R$)</span>
        <input
          type="text" inputMode="decimal" value={limiteReparos}
          onChange={e => setLimiteReparos(e.target.value)}
          placeholder="ex: 500,00"
          className={inputCls}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Por evento. Acima disso, só com autorização.</p>
      </label>
    </div>
  )
}
