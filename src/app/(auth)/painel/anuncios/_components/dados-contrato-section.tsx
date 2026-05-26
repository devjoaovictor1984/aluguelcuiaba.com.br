'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Info } from 'lucide-react'
import type { DadosContrato } from './dados-contrato'

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

function mascaraCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2')
}

interface Props {
  value: DadosContrato
  onChange: (v: DadosContrato) => void
  /** Se algum campo já vem preenchido, abre a seção por padrão. */
  defaultOpen?: boolean
}

export function DadosContratoSection({ value, onChange, defaultOpen = false }: Props) {
  const algumPreenchido = Object.values(value).some(v => v.trim().length > 0)
  const [aberto, setAberto] = useState(defaultOpen || algumPreenchido)

  const set = <K extends keyof DadosContrato>(campo: K, v: DadosContrato[K]) => {
    onChange({ ...value, [campo]: v })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <FileText size={16} className="text-violet-600 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dados pro contrato</h2>
            <p className="text-xs text-gray-500">
              {algumPreenchido
                ? 'Preenchido — clique pra editar'
                : 'Opcional · matrícula, UC, hidrômetro, etc.'}
            </p>
          </div>
        </div>
        {aberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-start gap-2 text-xs text-violet-900 bg-violet-50 border border-violet-100 rounded-lg p-3">
            <Info size={13} className="shrink-0 mt-0.5" />
            <p>
              Estes dados são usados <strong>só na geração de contrato</strong> — não aparecem no anúncio. Tudo opcional: se ficar vazio, o sistema usa o endereço/descrição do anúncio.
            </p>
          </div>

          {/* Endereço completo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Endereço pra contrato</p>
            <div className="space-y-2">
              <input
                type="text"
                value={value.endereco_completo}
                onChange={e => set('endereco_completo', e.target.value)}
                placeholder="Logradouro completo (ex: Avenida Manoel José de Arruda)"
                className={inputCls}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={value.endereco_numero}
                  onChange={e => set('endereco_numero', e.target.value)}
                  placeholder="Número"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={value.endereco_complemento}
                  onChange={e => set('endereco_complemento', e.target.value)}
                  placeholder="Complemento"
                  className={`${inputCls} col-span-2`}
                />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={value.endereco_cep}
                onChange={e => set('endereco_cep', mascaraCEP(e.target.value))}
                placeholder="CEP"
                className={inputCls}
                maxLength={9}
              />
            </div>
          </div>

          {/* Documentos do imóvel */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Documentação</p>
            <div className="space-y-2">
              <input
                type="text"
                value={value.matricula_cartorio}
                onChange={e => set('matricula_cartorio', e.target.value)}
                placeholder="Matrícula no cartório de registro de imóveis"
                className={inputCls}
              />
              <input
                type="text"
                value={value.cartorio_registro}
                onChange={e => set('cartorio_registro', e.target.value)}
                placeholder="Cartório de registro (ex: 1º Ofício de Cuiabá)"
                className={inputCls}
              />
              <input
                type="text"
                value={value.livro_folha_matricula}
                onChange={e => set('livro_folha_matricula', e.target.value)}
                placeholder="Livro / folha da matrícula"
                className={inputCls}
              />
              <input
                type="text"
                value={value.inscricao_municipal}
                onChange={e => set('inscricao_municipal', e.target.value)}
                placeholder="Inscrição municipal (IPTU)"
                className={inputCls}
              />
            </div>
          </div>

          {/* Concessionárias */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Concessionárias</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={value.uc_energia}
                onChange={e => set('uc_energia', e.target.value)}
                placeholder="UC energia (Energisa)"
                className={inputCls}
              />
              <input
                type="text"
                value={value.matricula_agua}
                onChange={e => set('matricula_agua', e.target.value)}
                placeholder="Matrícula água"
                className={inputCls}
              />
            </div>
          </div>

          {/* Medidores — números e leituras iniciais */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Medidores (números e leitura inicial)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={value.hidrometro_numero}
                onChange={e => set('hidrometro_numero', e.target.value)}
                placeholder="Hidrômetro nº"
                className={inputCls}
              />
              <input
                type="text"
                value={value.hidrometro_leitura_inicial}
                onChange={e => set('hidrometro_leitura_inicial', e.target.value)}
                placeholder="Leitura inicial água"
                className={inputCls}
              />
              <input
                type="text"
                value={value.medidor_energia_numero}
                onChange={e => set('medidor_energia_numero', e.target.value)}
                placeholder="Medidor energia nº"
                className={inputCls}
              />
              <input
                type="text"
                value={value.medidor_energia_leitura_inicial}
                onChange={e => set('medidor_energia_leitura_inicial', e.target.value)}
                placeholder="Leitura inicial energia"
                className={inputCls}
              />
            </div>
          </div>

          {/* Áreas */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Áreas (m²)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value.area_construida_m2}
                  onChange={e => set('area_construida_m2', e.target.value)}
                  placeholder="Construída"
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-400 mt-1">Pode diferir da área do anúncio</p>
              </div>
              <div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value.area_terreno_m2}
                  onChange={e => set('area_terreno_m2', e.target.value)}
                  placeholder="Terreno"
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-400 mt-1">Casa / lote</p>
              </div>
            </div>
          </div>

          {/* Descrição jurídica */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Descrição pro contrato</p>
            <textarea
              value={value.descricao_real}
              onChange={e => set('descricao_real', e.target.value)}
              rows={4}
              placeholder='Ex: "Casa térrea, 3 quartos sendo 1 suíte, sala ampla, cozinha, área de serviço, garagem para 2 veículos, quintal nos fundos, edificada em lote de 250m², matriculada sob nº..."'
              className={`${inputCls} resize-y`}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Texto detalhado/jurídico. Vazio = usa a descrição do anúncio.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
