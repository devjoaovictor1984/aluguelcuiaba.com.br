'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Bairro, Imovel, TipoImovel } from '@/types'
import { TIPOS_IMOVEL } from '@/lib/constants'
import { validarWhatsApp } from '@/lib/utils'
import { Editor } from '@/components/editor'
import {
  ChevronLeft, Camera, X, Plus, Loader2, AlertCircle, Trash2,
  ChevronDown, Home, Building2, Layers, Briefcase, MapPin,
  DollarSign, Droplets, Zap, Flame, Package, SplitSquareHorizontal, Lock, Star,
} from 'lucide-react'

const MAX_FOTOS = 20

async function comprimirImagem(file: File, maxWidth = 1200, qualidade = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', qualidade)
      URL.revokeObjectURL(url)
    }
    img.onerror = reject; img.src = url
  })
}

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trimEnd()
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trimEnd()
}
function mascaraCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2')
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{titulo}</h2>
      {children}
    </section>
  )
}
function Campo({ label, children, opcional }: { label: string; children: React.ReactNode; opcional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        {label}{opcional && <span className="text-xs text-gray-400 font-normal">(opcional)</span>}
      </label>
      {children}
    </div>
  )
}

function PillGroup<T extends string | number>({ options, value, onChange, label }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void; label: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${value === o.value ? 'bg-violet-700 border-violet-700 text-white' : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
function Toggle({ ativo, onChange, label, desc }: { ativo: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!ativo)} className="flex items-center justify-between w-full py-1">
      <div className="text-left">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${ativo ? 'bg-violet-600' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  )
}
function ValorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
      <input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="0,00" min={0} className={`${inputCls} pl-9`} />
    </div>
  )
}

function BairroCombobox({ bairros, value, onChange }: { bairros: Bairro[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = bairros.find(b => b.id === value)
  const filtered = bairros.filter(b => b.nome.toLowerCase().includes(search.toLowerCase()))
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${!selected ? 'text-gray-400' : 'text-gray-900'}`}>
        <span className="flex items-center gap-2"><MapPin size={14} className="text-gray-400 shrink-0" />{selected ? selected.nome : 'Selecione o bairro'}</span>
        <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bairro..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <li className="px-4 py-3 text-sm text-gray-400 text-center">Nenhum bairro encontrado</li>}
            {filtered.map(b => (
              <li key={b.id} onClick={() => { onChange(b.id); setSearch(''); setOpen(false) }}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-violet-50 hover:text-violet-700 transition-colors ${b.id === value ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700'}`}>
                {b.nome}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const TIPO_ICONS: Record<string, React.ReactNode> = {
  apartamento: <Building2 size={16} />, casa: <Home size={16} />, kitnet: <Layers size={16} />,
  comercial: <Briefcase size={16} />, terreno: <MapPin size={16} />,
}
const QUARTOS_OPTS = [{ value: 0, label: 'Estúdio' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5+' }]
const SUITES_OPTS = [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3+' }]
const BANHEIROS_OPTS = [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4+' }]
const VAGAS_OPTS = [{ value: 0, label: 'Sem vaga' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3+' }]

interface FotoExistente { id: string; url: string; principal: boolean; removida: boolean }
interface FotoNova { file: File; preview: string; blob?: Blob }

interface Props {
  imovel: Imovel & { fotos?: Array<{ id: string; url: string; principal: boolean; ordem: number }> }
  bairros: Bairro[]
  userId: string
  telefoneInicial?: string
}

export function EditarAnuncioForm({ imovel, bairros, userId, telefoneInicial = '' }: Props) {
  const router = useRouter()
  const fileInputId = useId()

  // ── básico ──
  const [tipo, setTipo] = useState<TipoImovel>(imovel.tipo)
  const [titulo, setTitulo] = useState(imovel.titulo)
  const [descricao, setDescricao] = useState(imovel.descricao ?? '')

  // ── localização ──
  const [bairroId, setBairroId] = useState(imovel.bairro_id ?? '')
  const [condominioNome, setCondominioNome] = useState(imovel.condominio_nome ?? '')
  const [imovelCep, setImovelCep] = useState('')
  const [imovelLogradouro, setImovelLogradouro] = useState(imovel.endereco_resumido ?? '')
  const [imovelNumero, setImovelNumero] = useState('')
  const [imovelComplemento, setImovelComplemento] = useState('')
  const [buscandoEndereco, setBuscandoEndereco] = useState(false)

  // ── características ──
  const [quartos, setQuartos] = useState(imovel.quartos)
  const [suites, setSuites] = useState((imovel as unknown as Record<string, unknown>).suites as number ?? 0)
  const [banheiros, setBanheiros] = useState(imovel.banheiros)
  const [vagas, setVagas] = useState(imovel.vagas)
  const [areaM2, setAreaM2] = useState(imovel.area_m2 ? String(imovel.area_m2) : '')
  const [piscina, setPiscina] = useState((imovel as unknown as Record<string, unknown>).piscina as boolean ?? false)
  const [aceitaPets, setAceitaPets] = useState(imovel.aceita_pets)
  const [mobiliadoTipo, setMobiliadoTipo] = useState<'nao' | 'semi' | 'sim'>(() => {
    const semi = (imovel as unknown as Record<string, unknown>).semimobiliado as boolean ?? false
    if (imovel.mobiliado) return 'sim'
    if (semi) return 'semi'
    return 'nao'
  })

  // ── valores ──
  const [custoTipo, setCustoTipo] = useState<'separado' | 'pacote'>(
    (imovel as unknown as Record<string, unknown>).custo_tipo as 'separado' | 'pacote' ?? 'separado'
  )
  const [preco, setPreco] = useState(String(imovel.preco))
  const [taxaCondo, setTaxaCondo] = useState(imovel.taxa_condominio ? String(imovel.taxa_condominio) : '')
  const [iptu, setIptu] = useState(imovel.iptu ? String(imovel.iptu) : '')
  const [gasIncluso, setGasIncluso] = useState((imovel as unknown as Record<string, unknown>).gas_incluso as boolean ?? false)
  const [aguaInclusa, setAguaInclusa] = useState((imovel as unknown as Record<string, unknown>).agua_inclusa as boolean ?? false)
  const [luzInclusa, setLuzInclusa] = useState((imovel as unknown as Record<string, unknown>).luz_inclusa as boolean ?? false)

  // ── contato ──
  const [whatsapp, setWhatsapp] = useState(() => mascaraTelefone(imovel.whatsapp || telefoneInicial))
  const [observacoes, setObservacoes] = useState((imovel as unknown as Record<string, unknown>).observacoes as string ?? '')

  // ── fotos ──
  const [fotosExistentes, setFotosExistentes] = useState<FotoExistente[]>(
    (imovel.fotos ?? []).map(f => ({ id: f.id, url: f.url, principal: f.principal, removida: false }))
  )
  const [fotosNovas, setFotosNovas] = useState<FotoNova[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // ── submit ──
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')

  const totalFotos = fotosExistentes.filter(f => !f.removida).length + fotosNovas.length

  const buscarCepImovel = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '')
    if (limpo.length !== 8) return
    setBuscandoEndereco(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await res.json()
      if (!data.erro) setImovelLogradouro(data.logradouro ?? '')
    } catch {}
    setBuscandoEndereco(false)
  }, [])

  const adicionarFotos = useCallback(async (files: FileList | null) => {
    if (!files) return
    const disponiveis = MAX_FOTOS - totalFotos
    const novas: FotoNova[] = []
    for (let i = 0; i < Math.min(files.length, disponiveis); i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const blob = await comprimirImagem(file)
      novas.push({ file, preview: URL.createObjectURL(blob), blob })
    }
    setFotosNovas(prev => [...prev, ...novas])
  }, [totalFotos])

  const removerExistente = (id: string) => {
    setFotosExistentes(prev => prev.map(f => f.id === id ? { ...f, removida: true } : f))
  }
  const removerNova = (idx: number) => {
    setFotosNovas(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (titulo.trim().length < 5) { setErro('Título muito curto.'); return }
    if (!bairroId) { setErro('Selecione o bairro do imóvel.'); return }
    const precoNum = parseFloat(preco.replace(',', '.'))
    if (!precoNum || precoNum <= 0) { setErro('Informe o valor do aluguel.'); return }
    const whatsappLimpo = whatsapp.replace(/\D/g, '')
    if (!validarWhatsApp(whatsappLimpo)) { setErro('WhatsApp inválido. Use o formato: (65) 99988-7766'); return }

    setEnviando(true)
    try {
      const supabase = createClient()
      setProgresso('Salvando alterações...')

      const enderecoMontado = [imovelLogradouro, imovelNumero, imovelComplemento].filter(Boolean).join(', ')

      const { error: updateErr } = await supabase.from('imoveis').update({
        titulo: titulo.trim(),
        descricao: descricao || null,
        tipo,
        bairro_id: bairroId,
        condominio_nome: condominioNome.trim() || null,
        endereco_resumido: enderecoMontado || null,
        preco: precoNum,
        taxa_condominio: custoTipo === 'separado' && taxaCondo ? parseFloat(taxaCondo.replace(',', '.')) : null,
        iptu: custoTipo === 'separado' && iptu ? parseFloat(iptu.replace(',', '.')) : null,
        quartos,
        suites,
        banheiros,
        vagas,
        area_m2: areaM2 ? parseFloat(areaM2.replace(',', '.')) : null,
        piscina,
        aceita_pets: aceitaPets,
        mobiliado: mobiliadoTipo === 'sim',
        semimobiliado: mobiliadoTipo === 'semi',
        observacoes: observacoes.trim() || null,
        custo_tipo: custoTipo,
        gas_incluso: gasIncluso,
        agua_inclusa: aguaInclusa,
        luz_inclusa: luzInclusa,
        whatsapp: whatsappLimpo,
      }).eq('id', imovel.id)

      if (updateErr) throw new Error(updateErr.message)

      // Remove fotos marcadas
      const removidas = fotosExistentes.filter(f => f.removida)
      for (const foto of removidas) {
        // Extract storage path from URL
        const pathMatch = foto.url.match(/fotos-imoveis\/(.+?)(\?|$)/)
        if (pathMatch) await supabase.storage.from('fotos-imoveis').remove([pathMatch[1]])
        await supabase.from('fotos').delete().eq('id', foto.id)
      }

      // Upload novas fotos
      if (fotosNovas.length > 0) {
        const existentesAtivas = fotosExistentes.filter(f => !f.removida)
        for (let i = 0; i < fotosNovas.length; i++) {
          setProgresso(`Enviando fotos ${i + 1}/${fotosNovas.length}...`)
          const blob = fotosNovas[i].blob ?? await comprimirImagem(fotosNovas[i].file)
          const ordem = existentesAtivas.length + i + 1
          const path = `${userId}/${imovel.id}/${Date.now()}-${i + 1}.jpg`
          const { error: uploadErr } = await supabase.storage.from('fotos-imoveis').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
          if (uploadErr) throw new Error(uploadErr.message)
          const { data: { publicUrl } } = supabase.storage.from('fotos-imoveis').getPublicUrl(path)
          await supabase.from('fotos').insert({
            imovel_id: imovel.id, url: publicUrl, ordem,
            principal: existentesAtivas.length === 0 && i === 0,
          })
        }
      }

      // Geocoda em background — endereço pode ter mudado
      fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imovel_id: imovel.id }),
      }).catch(() => {})

      router.push('/painel?atualizado=1')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.')
      setEnviando(false)
      setProgresso('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/painel" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors shrink-0">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Editar anúncio</h1>
      </div>

      {/* ── Fotos ── */}
      <Secao titulo="Fotos do imóvel">
        <input ref={fileRef} id={fileInputId} type="file" accept="image/*" multiple className="sr-only"
          onChange={e => adicionarFotos(e.target.files)} onClick={e => { (e.target as HTMLInputElement).value = '' }} />

        {totalFotos === 0 ? (
          <label htmlFor={fileInputId}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl h-40 cursor-pointer hover:border-violet-300 hover:bg-violet-50/40 transition-colors">
            <Camera size={22} className="text-violet-500" />
            <p className="text-sm text-gray-500">Adicionar fotos</p>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {/* Fotos existentes */}
              {fotosExistentes.filter(f => !f.removida).map((foto, i) => {
                const isDestaque = i === 0 && fotosNovas.length === 0
                return (
                  <div key={foto.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={foto.url} alt="" className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => i !== 0 && setFotosExistentes(prev => {
                        const ativas = prev.filter(f => !f.removida)
                        const rem = prev.filter(f => f.removida)
                        return [ativas[i], ...ativas.filter((_, j) => j !== i), ...rem]
                      })}
                      title={isDestaque ? 'Foto destaque' : 'Definir como destaque'}
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isDestaque ? 'bg-yellow-400 text-white' : 'bg-black/40 text-white/60 hover:bg-yellow-400 hover:text-white'
                      }`}>
                      <Star size={10} fill={isDestaque ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" onClick={() => removerExistente(foto.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
              {/* Fotos novas */}
              {fotosNovas.map((foto, i) => {
                const existAtivas = fotosExistentes.filter(f => !f.removida).length
                const isDestaque = existAtivas === 0 && i === 0
                return (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={foto.preview} alt="" className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => !isDestaque && setFotosNovas(prev => [prev[i], ...prev.filter((_, j) => j !== i)])}
                      title={isDestaque ? 'Foto destaque' : 'Definir como destaque'}
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isDestaque ? 'bg-yellow-400 text-white' : 'bg-black/40 text-white/60 hover:bg-yellow-400 hover:text-white'
                      }`}>
                      <Star size={10} fill={isDestaque ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" onClick={() => removerNova(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
              {/* Add more */}
              {totalFotos < MAX_FOTOS && (
                <label htmlFor={fileInputId}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-violet-300 hover:bg-violet-50/40 transition-colors">
                  <Plus size={20} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400">{totalFotos}/{MAX_FOTOS}</span>
                </label>
              )}
            </div>
          </div>
        )}
      </Secao>

      {/* ── Tipo ── */}
      <Secao titulo="Tipo do imóvel">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TIPOS_IMOVEL.map(t => (
            <button key={t.value} type="button" onClick={() => setTipo(t.value as TipoImovel)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${tipo === t.value ? 'bg-violet-700 border-violet-700 text-white' : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700'}`}>
              {TIPO_ICONS[t.value]}{t.label}
            </button>
          ))}
        </div>
      </Secao>

      {/* ── Título ── */}
      <Secao titulo="Informações básicas">
        <Campo label="Título do anúncio">
          <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Ex: Apartamento 2 quartos no Centro" maxLength={100} className={inputCls} />
          <p className="text-xs text-gray-400 text-right">{titulo.length}/100</p>
        </Campo>
      </Secao>

      {/* ── Localização ── */}
      <Secao titulo="Localização">
        <div className="space-y-4">
          <Campo label="Bairro">
            <BairroCombobox bairros={bairros} value={bairroId} onChange={setBairroId} />
          </Campo>
          <Campo label="Nome do condomínio" opcional>
            <input type="text" value={condominioNome} onChange={e => setCondominioNome(e.target.value)}
              placeholder="Ex: Residencial Jardim Europa" maxLength={100} className={inputCls} />
          </Campo>
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700">Endereço do imóvel</p>
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Lock size={9} />privado
              </span>
            </div>
            <p className="text-xs text-gray-400 -mt-1">Não aparece no anúncio — só o bairro é exibido publicamente.</p>
            <div className="relative">
              <input type="text" inputMode="numeric" value={imovelCep}
                onChange={e => { const v = mascaraCEP(e.target.value); setImovelCep(v); if (v.replace(/\D/g, '').length === 8) buscarCepImovel(v) }}
                placeholder="CEP (opcional)" className={`${inputCls} pr-10`} />
              {buscandoEndereco && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input type="text" value={imovelLogradouro} onChange={e => setImovelLogradouro(e.target.value)}
                  placeholder="Rua / Avenida" className={inputCls} />
              </div>
              <input type="text" value={imovelNumero} onChange={e => setImovelNumero(e.target.value)}
                placeholder="Número" className={inputCls} />
            </div>
            <input type="text" value={imovelComplemento} onChange={e => setImovelComplemento(e.target.value)}
              placeholder="Complemento (Apto, Bloco, Casa...)" className={inputCls} />
          </div>
        </div>
      </Secao>

      {/* ── Características ── */}
      <Secao titulo="Características">
        <div className="space-y-5">
          <PillGroup label="Quartos" options={QUARTOS_OPTS} value={quartos} onChange={setQuartos} />
          <div className="h-px bg-gray-100" />
          <PillGroup label="Suítes" options={SUITES_OPTS} value={suites} onChange={setSuites} />
          <div className="h-px bg-gray-100" />
          <PillGroup label="Banheiros" options={BANHEIROS_OPTS} value={banheiros} onChange={setBanheiros} />
          <div className="h-px bg-gray-100" />
          <PillGroup label="Vagas de garagem" options={VAGAS_OPTS} value={vagas} onChange={setVagas} />
          <div className="h-px bg-gray-100" />
          <Campo label="Área construída" opcional>
            <div className="relative">
              <input type="number" inputMode="decimal" value={areaM2} onChange={e => setAreaM2(e.target.value)}
                placeholder="0" min={1} className={`${inputCls} pr-12`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m²</span>
            </div>
          </Campo>
          <div className="h-px bg-gray-100" />
          <div className="space-y-3">
            <Toggle ativo={piscina} onChange={setPiscina} label="🏊 Piscina" />
            <div className="h-px bg-gray-100" />
            <Toggle ativo={aceitaPets} onChange={setAceitaPets} label="🐾 Aceita pets" desc="Cães, gatos e outros animais" />
            <div className="h-px bg-gray-100" />
            <PillGroup
              label="🛋️ Mobiliado"
              options={[
                { value: 'nao' as const, label: 'Não' },
                { value: 'semi' as const, label: 'Semi' },
                { value: 'sim' as const, label: 'Sim' },
              ]}
              value={mobiliadoTipo}
              onChange={setMobiliadoTipo}
            />
          </div>
        </div>
      </Secao>

      {/* ── Valores ── */}
      <Secao titulo="Valores e custos">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Como é o aluguel?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCustoTipo('separado')}
                className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-colors text-center ${custoTipo === 'separado' ? 'bg-violet-50 border-violet-500 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <SplitSquareHorizontal size={20} />
                <span className="text-xs font-semibold">Custos separados</span>
              </button>
              <button type="button" onClick={() => setCustoTipo('pacote')}
                className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-colors text-center ${custoTipo === 'pacote' ? 'bg-violet-50 border-violet-500 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <Package size={20} />
                <span className="text-xs font-semibold">Pacote tudo incluso</span>
              </button>
            </div>
          </div>
          {custoTipo === 'pacote' ? (
            <Campo label="Valor total do pacote">
              <ValorInput value={preco} onChange={setPreco} />
            </Campo>
          ) : (
            <>
              <Campo label="Aluguel mensal"><ValorInput value={preco} onChange={setPreco} /></Campo>
              <Campo label="Taxa de condomínio" opcional><ValorInput value={taxaCondo} onChange={setTaxaCondo} /></Campo>
              <Campo label="IPTU mensal" opcional><ValorInput value={iptu} onChange={setIptu} /></Campo>
            </>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Incluso:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'gas', label: 'Gás', icon: <Flame size={13} />, value: gasIncluso, set: setGasIncluso },
                { key: 'agua', label: 'Água', icon: <Droplets size={13} />, value: aguaInclusa, set: setAguaInclusa },
                { key: 'luz', label: 'Luz', icon: <Zap size={13} />, value: luzInclusa, set: setLuzInclusa },
              ].map(item => (
                <button key={item.key} type="button" onClick={() => item.set(!item.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${item.value ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {item.icon}{item.label}{item.value && <span className="text-green-500">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      {/* ── Descrição ── */}
      <Secao titulo="Descrição">
        <Editor value={descricao} onChange={setDescricao} placeholder="Descreva o imóvel..." minHeight={200} />
      </Secao>

      {/* ── Observações ── */}
      <Secao titulo="Observações">
        <Campo label="Informações adicionais" opcional>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Condições especiais, regras da locação, forma de pagamento, restrições..."
            rows={3}
            maxLength={500}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-gray-400 text-right">{observacoes.length}/500</p>
        </Campo>
      </Secao>

      {/* ── Contato ── */}
      <Secao titulo="Contato">
        <Campo label="WhatsApp para contato">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🇧🇷</span>
            <input type="tel" value={whatsapp} disabled
              placeholder="(65) 99988-7766" className={`${inputCls} pl-9 opacity-70 cursor-not-allowed bg-gray-50`} />
          </div>
          <p className="text-xs text-gray-400">Número do seu cadastro · altere no <Link href="/painel/perfil" className="underline text-violet-600">perfil</Link>.</p>
        </Campo>
      </Secao>

      {/* Deletar anúncio */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Excluir este anúncio permanentemente?')) return
            const supabase = createClient()
            await supabase.from('imoveis').delete().eq('id', imovel.id)
            router.push('/painel')
          }}
          className="text-sm text-red-500 hover:text-red-700 hover:underline flex items-center gap-1.5 mx-auto"
        >
          <Trash2 size={13} /> Excluir este anúncio
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{erro}</span>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button type="submit" disabled={enviando}
          className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors text-base">
          {enviando ? <><Loader2 size={18} className="animate-spin" />{progresso}</> : <><DollarSign size={18} />Salvar alterações</>}
        </button>
      </div>
    </form>
  )
}
