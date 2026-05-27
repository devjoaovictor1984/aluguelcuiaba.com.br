'use client'

import { useState, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Perfil, TipoUsuario } from '@/types'
import { PLANOS } from '@/lib/constants'
import {
  ChevronLeft, Loader2, AlertCircle, CheckCircle2,
  User, Phone, CreditCard, MapPin, Building2, Camera, LogOut,
  Lock, Eye, EyeOff, Crown, ArrowRight,
} from 'lucide-react'

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"
const readOnlyCls = `${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`

function mascaraCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trimEnd()
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trimEnd()
}
function mascaraCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2')
}
function mascaraCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let r = (sum * 10) % 11; if (r >= 10) r = 0
  if (r !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  r = (sum * 10) % 11; if (r >= 10) r = 0
  return r === parseInt(d[10])
}
async function comprimirAvatar(file: File, size = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      const min = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size)
      canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', 0.88)
      URL.revokeObjectURL(url)
    }
    img.onerror = reject; img.src = url
  })
}

const TIPOS: { value: TipoUsuario; label: string; desc: string }[] = [
  { value: 'proprietario', label: 'Proprietário', desc: 'Anuncio meu próprio imóvel' },
  { value: 'corretor', label: 'Corretor', desc: 'Sou corretor de imóveis (CRECI)' },
  { value: 'imobiliaria', label: 'Imobiliária', desc: 'Represento uma imobiliária' },
]

interface Props {
  userId: string
  email: string
  perfilInicial: Perfil | null
  isNovo: boolean
}

export function PerfilForm({ userId, email, perfilInicial, isNovo }: Props) {
  const router = useRouter()
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // ── Profile fields ──
  const [nome, setNome] = useState(perfilInicial?.nome ?? '')
  const [cpf, setCpf] = useState(perfilInicial?.cpf ? mascaraCPF(perfilInicial.cpf) : '')
  const [telefone, setTelefone] = useState(perfilInicial?.telefone ? mascaraTelefone(perfilInicial.telefone) : '')
  const [tipo, setTipo] = useState<TipoUsuario>(perfilInicial?.tipo ?? 'proprietario')
  const [creci, setCreci] = useState(perfilInicial?.creci ?? '')
  const [razaoSocial, setRazaoSocial] = useState(perfilInicial?.razao_social ?? '')
  const [cnpj, setCnpj] = useState(perfilInicial?.cnpj ? mascaraCNPJ(perfilInicial.cnpj) : '')
  const [creciJuridico, setCreciJuridico] = useState(perfilInicial?.creci_juridico ?? '')
  const [cep, setCep] = useState(perfilInicial?.endereco_cep ? mascaraCEP(perfilInicial.endereco_cep) : '')
  const [logradouro, setLogradouro] = useState(perfilInicial?.endereco_logradouro ?? '')
  const [numero, setNumero] = useState(perfilInicial?.endereco_numero ?? '')
  const [bairro, setBairro] = useState(perfilInicial?.endereco_bairro ?? '')
  const [cidade, setCidade] = useState(perfilInicial?.endereco_cidade ?? 'Cuiabá')
  const [uf, setUf] = useState(perfilInicial?.endereco_uf ?? 'MT')

  const [fotoPreview, setFotoPreview] = useState<string | null>(perfilInicial?.foto_url ?? null)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)

  const [buscandoCep, setBuscandoCep] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)

  // ── Password change ──
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [alterandoSenha, setAlterandoSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [senhaAlterada, setSenhaAlterada] = useState(false)

  const plano = (perfilInicial?.plano ?? 'free') as keyof typeof PLANOS
  const planoInfo = PLANOS[plano]
  const isAdmin = (perfilInicial as unknown as Record<string, unknown>)?.role === 'admin'

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const blob = await comprimirAvatar(file)
    setFotoPreview(URL.createObjectURL(blob))
    setFotoBlob(blob)
  }

  const buscarCep = async (cepVal: string) => {
    const limpo = cepVal.replace(/\D/g, '')
    if (limpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setLogradouro(data.logradouro ?? ''); setBairro(data.bairro ?? '')
        setCidade(data.localidade ?? ''); setUf(data.uf ?? '')
      }
    } catch {}
    setBuscandoCep(false)
  }

  const handleSair = async () => {
    setSaindo(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleAlterarSenha = async () => {
    setErroSenha('')
    if (novaSenha.length < 6) { setErroSenha('A senha deve ter pelo menos 6 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErroSenha('As senhas não coincidem.'); return }
    setAlterandoSenha(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) { setErroSenha(error.message); setAlterandoSenha(false); return }
    setSenhaAlterada(true)
    setNovaSenha(''); setConfirmaSenha('')
    setAlterandoSenha(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (nome.trim().length < 3) { setErro('Informe seu nome completo.'); return }
    if (!validarCPF(cpf)) { setErro('CPF inválido.'); return }
    if (isNovo) {
      const telLimpo = telefone.replace(/\D/g, '')
      if (telLimpo.length < 10) { setErro('Telefone inválido.'); return }
    }
    if (!logradouro) { setErro('Preencha o endereço completo.'); return }
    if ((tipo === 'corretor' || tipo === 'imobiliaria') && !creci.trim()) {
      setErro('Informe o número do CRECI.'); return
    }

    setSalvando(true)
    const supabase = createClient()
    let foto_url = perfilInicial?.foto_url ?? null

    if (fotoBlob) {
      const path = `${userId}/avatar.jpg`
      const { error: uploadErr } = await supabase.storage.from('avatares').upload(path, fotoBlob, { contentType: 'image/jpeg', upsert: true })
      if (uploadErr) {
        setSalvando(false)
        setErro(`Erro ao enviar foto: ${uploadErr.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('avatares').getPublicUrl(path)
      foto_url = `${publicUrl}?t=${Date.now()}`
    }

    const updates: Record<string, unknown> = {
      id: userId, nome: nome.trim(), cpf: cpf.replace(/\D/g, ''),
      tipo, creci: creci.trim() || null, foto_url,
      razao_social: razaoSocial.trim() || null,
      cnpj: cnpj.replace(/\D/g, '') || null,
      creci_juridico: creciJuridico.trim() || null,
      endereco_cep: cep.replace(/\D/g, ''), endereco_logradouro: logradouro.trim(),
      endereco_numero: numero.trim(), endereco_bairro: bairro.trim(),
      endereco_cidade: cidade.trim(), endereco_uf: uf.trim().toUpperCase(),
      consentimento_lgpd_em: perfilInicial?.consentimento_lgpd_em ?? new Date().toISOString(),
    }
    if (isNovo) updates.telefone = telefone.replace(/\D/g, '')

    const { error } = await supabase.from('perfis').upsert(updates, { onConflict: 'id' })
    if (error) { setSalvando(false); setErro(`Erro ao salvar: ${error.message}`); return }

    setSalvo(true)
    setTimeout(() => router.push('/painel'), 900)
  }

  const precisaCreci = tipo === 'corretor' || tipo === 'imobiliaria'

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 pb-32 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {!isNovo && (
            <Link href="/painel" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors shrink-0">
              <ChevronLeft size={20} />
            </Link>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isNovo ? 'Complete seu cadastro' : 'Meu perfil'}</h1>
            {isNovo && <p className="text-sm text-gray-500">Necessário para publicar anúncios.</p>}
          </div>
        </div>
        <button type="button" onClick={handleSair} disabled={saindo}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          {saindo ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Sair
        </button>
      </div>

      {/* ── Foto ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center shrink-0 cursor-pointer border-2 border-violet-200 hover:border-violet-400 transition-colors"
            onClick={() => fotoInputRef.current?.click()}
          >
            {fotoPreview
              ? <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
              : <User size={28} className="text-violet-400" />
            }
          </div>
          <div>
            <button type="button" onClick={() => fotoInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-800 transition-colors">
              <Camera size={15} />
              {fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG ou PNG · Recortada em círculo</p>
          </div>
          <input ref={fotoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFotoChange} />
        </div>
      </section>

      {/* ── Conta ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Conta</h2>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail</label>
          <input type="email" value={email} readOnly className={readOnlyCls} />
          <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado.</p>
        </div>
        {!isNovo && perfilInicial?.telefone && (
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5"><Phone size={14} className="text-gray-400" /> Telefone / WhatsApp</label>
            <input type="tel" value={mascaraTelefone(perfilInicial.telefone)} readOnly className={readOnlyCls} />
            <p className="text-xs text-gray-400 mt-1">Para alterar o contato, use o campo WhatsApp no anúncio.</p>
          </div>
        )}
      </section>

      {/* ── Dados pessoais ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Dados pessoais</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><User size={14} className="text-gray-400" /> Nome completo</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="João da Silva" required className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><CreditCard size={14} className="text-gray-400" /> CPF</label>
          <input type="text" inputMode="numeric" value={cpf} onChange={e => setCpf(mascaraCPF(e.target.value))} placeholder="000.000.000-00" required className={inputCls} />
          <p className="text-xs text-gray-400">Protegido pela LGPD · nunca compartilhado.</p>
        </div>
        {isNovo && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Phone size={14} className="text-gray-400" /> Telefone / WhatsApp</label>
            <input type="tel" inputMode="numeric" value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} placeholder="(65) 99988-7766" required className={inputCls} />
          </div>
        )}
      </section>

      {/* ── Tipo de anunciante ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Building2 size={14} /> Tipo de anunciante</h2>
        <div className="space-y-2">
          {TIPOS.map(t => (
            <button key={t.value} type="button" onClick={() => setTipo(t.value)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-colors ${tipo === t.value ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${tipo === t.value ? 'border-violet-500 bg-violet-500' : 'border-gray-300'}`}>
                {tipo === t.value && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {precisaCreci && (
          <div className="space-y-1.5 pt-1">
            <label className="text-sm font-medium text-gray-700">Número do CRECI</label>
            <input type="text" value={creci} onChange={e => setCreci(e.target.value)} placeholder="Ex: 12345-F" required={precisaCreci} className={inputCls} />
            <p className="text-xs text-gray-400">Obrigatório para corretores e imobiliárias.</p>
          </div>
        )}

        {(tipo === 'imobiliaria' || tipo === 'corretor') && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-2">
              {tipo === 'imobiliaria' ? 'Dados jurídicos da imobiliária' : 'Dados jurídicos (opcional)'}
            </p>
            <p className="text-xs text-gray-500 -mt-1">
              {tipo === 'imobiliaria'
                ? 'Aparecem no cabeçalho de contratos, vistorias e recibos.'
                : 'Se você é MEI ou tem CNPJ próprio, aparece no contrato como administradora. Opcional para corretor PF.'}
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Razão social {tipo === 'corretor' && <span className="text-gray-400">(opcional)</span>}</label>
              <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Ex: IMOBILIATTO" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">CNPJ {tipo === 'corretor' && <span className="text-gray-400">(opcional)</span>}</label>
              <input type="text" inputMode="numeric" value={cnpj} onChange={e => setCnpj(mascaraCNPJ(e.target.value))} placeholder="00.000.000/0000-00" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">CRECI Jurídico {tipo === 'corretor' && <span className="text-gray-400">(opcional)</span>}</label>
              <input type="text" value={creciJuridico} onChange={e => setCreciJuridico(e.target.value)} placeholder="Ex: 14137-J" className={inputCls} />
              <p className="text-xs text-gray-400">CRECI da pessoa jurídica, distinto do CRECI do corretor responsável.</p>
            </div>
          </div>
        )}
      </section>

      {/* ── Endereço ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><MapPin size={14} /> Endereço</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">CEP</label>
          <div className="relative">
            <input type="text" inputMode="numeric" value={cep}
              onChange={e => { const v = mascaraCEP(e.target.value); setCep(v); if (v.replace(/\D/g, '').length === 8) buscarCep(v) }}
              placeholder="00000-000" required className={`${inputCls} pr-10`} />
            {buscandoCep && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Rua / Avenida</label>
            <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Av. Brasil" required className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Número</label>
            <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" className={inputCls} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Bairro</label>
          <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro" className={inputCls} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Cidade</label>
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cuiabá" required className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">UF</label>
            <input type="text" value={uf} onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="MT" required className={`${inputCls} uppercase`} maxLength={2} />
          </div>
        </div>
      </section>

      {/* ── Trocar senha (somente no edit, não no cadastro inicial) ── */}
      {!isNovo && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Lock size={14} /> Trocar senha</h2>
          {senhaAlterada ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 size={16} /> Senha alterada com sucesso!
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Nova senha (mín. 6 caracteres)"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowSenha(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={confirmaSenha}
                  onChange={e => setConfirmaSenha(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className={inputCls}
                />
              </div>
              {erroSenha && (
                <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} />{erroSenha}</p>
              )}
              <button
                type="button"
                onClick={handleAlterarSenha}
                disabled={alterandoSenha || !novaSenha}
                className="flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {alterandoSenha ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Alterar senha
              </button>
            </>
          )}
        </section>
      )}

      {/* ── Plano ── */}
      {!isNovo && !isAdmin && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5"><Crown size={14} /> Plano atual</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{planoInfo?.nome ?? 'Gratuito'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {planoInfo?.imoveis === 999 ? 'Anúncios ilimitados' : `Até ${planoInfo?.imoveis} anúncio${planoInfo?.imoveis !== 1 ? 's' : ''}`}
              </p>
            </div>
            {plano === 'free' && (
              <Link
                href="/planos"
                className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                Fazer upgrade <ArrowRight size={14} />
              </Link>
            )}
            {plano !== 'free' && (
              <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-3 py-1 rounded-full">Ativo</span>
            )}
          </div>
        </section>
      )}

      {/* ── Erro geral ── */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{erro}</span>
        </div>
      )}

      {/* ── Submit fixo ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button
          type="submit" disabled={salvando || salvo}
          className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors text-base"
        >
          {salvo
            ? <><CheckCircle2 size={18} />Salvo!</>
            : salvando
              ? <><Loader2 size={18} className="animate-spin" />Salvando...</>
              : isNovo ? 'Concluir cadastro' : 'Salvar alterações'
          }
        </button>
      </div>
    </form>
  )
}
