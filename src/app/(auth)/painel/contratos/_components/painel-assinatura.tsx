'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PenLine, Plus, Trash2, Loader2, Send, Copy, Check, Clock, CheckCircle2, X, Download, MessageCircle, Pencil, Mail, ShieldCheck } from 'lucide-react'
import { criarProcessoAssinatura, cancelarProcessoAssinatura, atualizarEmailSignatario, reenviarConviteSignatario } from '../assinatura-actions'
import { ConfirmarEnvioAssinatura } from './confirmar-envio-assinatura'

interface Sugestao { nome: string; email: string; papel: string }
interface SignatarioStatus {
  id: string; nome: string; email: string; papel: string | null; status: string; token: string
  assinado_em: string | null; ip: string | null; geo: string | null; user_agent: string | null
  otp_verificado: boolean; selfie_url: string | null
}
interface Processo { id: string; status: string; created_at: string; codigo_validacao: string | null; signatarios: SignatarioStatus[] }

// User-agent é longo demais pro painel: resume em "Navegador · Sistema".
function resumirDispositivo(ua: string | null): string | null {
  if (!ua) return null
  const nav =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /Firefox\//.test(ua) ? 'Firefox' : 'Navegador'
  const so =
    /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'Mac' :
    /Linux/.test(ua) ? 'Linux' : null
  return so ? `${nav} · ${so}` : nav
}

const fmtDataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—'

interface Props {
  tipoContrato: 'locacao' | 'administracao'
  contratoId: string
  titulo: string
  baseUrl: string
  sugestoes: Sugestao[]
  processos: Processo[]
}

interface Linha { nome: string; email: string; papel: string }

export function PainelAssinatura({ tipoContrato, contratoId, titulo, baseUrl, sugestoes, processos }: Props) {
  const router = useRouter()
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    const comEmail = sugestoes.filter(s => s.email)
    return comEmail.length > 0 ? comEmail.map(s => ({ ...s })) : [{ nome: '', email: '', papel: '' }]
  })
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [exigirOtp, setExigirOtp] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : baseUrl))
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [reenviado, setReenviado] = useState<string | null>(null)
  // Signatários já validados, esperando a confirmação do corretor.
  const [confirmando, setConfirmando] = useState<Linha[] | null>(null)

  const salvarEmail = (id: string) => {
    startTransition(async () => {
      const r = await atualizarEmailSignatario(id, editVal, true)
      if (r.error) { setErro(r.error); return }
      setErro(''); setEditId(null); setReenviado(id); setTimeout(() => setReenviado(null), 2500)
      router.refresh()
    })
  }
  const reenviar = (id: string) => {
    setErro('')
    startTransition(async () => {
      const r = await reenviarConviteSignatario(id)
      if (r.error) { setErro(r.error); return }
      setReenviado(id); setTimeout(() => setReenviado(null), 2500)
    })
  }

  const set = (i: number, campo: keyof Linha, v: string) =>
    setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: v } : l))
  const add = () => setLinhas(prev => [...prev, { nome: '', email: '', papel: '' }])
  const rem = (i: number) => setLinhas(prev => prev.filter((_, idx) => idx !== i))

  const enviar = () => {
    setErro('')
    const preenchidas = linhas.filter(l => l.nome.trim() || l.email.trim())
    const semEmail = preenchidas.filter(l => l.nome.trim() && !/\S+@\S+\.\S+/.test(l.email))
    if (semEmail.length > 0) {
      setErro(`${semEmail.map(l => l.nome.trim()).join(', ')} está sem e-mail válido. Assinar pela plataforma exige e-mail (recebe o código e o link). Preencha o e-mail ou tire da lista.`)
      return
    }
    const signatarios = linhas.filter(l => l.nome.trim() && /\S+@\S+\.\S+/.test(l.email))
    if (signatarios.length === 0) { setErro('Adicione ao menos 1 signatário com nome e e-mail válido.'); return }
    // A validação já passou; quem decide agora é o corretor, vendo pra
    // quem vai. Ver ConfirmarEnvioAssinatura.
    setConfirmando(signatarios)
  }

  const confirmarEnvio = () => {
    const signatarios = confirmando
    if (!signatarios) return
    startTransition(async () => {
      const r = await criarProcessoAssinatura({ tipo_contrato: tipoContrato, contrato_id: contratoId, titulo, signatarios, exigirOtp })
      if (r.error) { setErro(r.error); setConfirmando(null); return }
      setConfirmando(null)
      setLinhas([{ nome: '', email: '', papel: '' }])
      router.refresh()
    })
  }

  const copiarTexto = async (texto: string, marca: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(marca); setTimeout(() => setCopiado(null), 2000)
    } catch { setErro('Não consegui copiar.') }
  }
  const copiar = (token: string) => copiarTexto(`${origin}/assinar/${token}`, token)

  const whatsapp = (s: SignatarioStatus) => {
    const msg = `Olá ${s.nome.split(' ')[0]}, segue o link para você assinar o contrato ${titulo}${s.papel ? ` (como ${s.papel})` : ''}:\n\n${origin}/assinar/${s.token}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const cancelar = (id: string) => {
    if (!confirm('Cancelar este processo de assinatura? Os links param de funcionar.')) return
    startTransition(async () => {
      const r = await cancelarProcessoAssinatura(id)
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  const ativos = processos.filter(p => p.status !== 'cancelado')

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      {confirmando && (
        <ConfirmarEnvioAssinatura
          signatarios={confirmando}
          exigirOtp={exigirOtp}
          enviando={isPending}
          onConfirmar={confirmarEnvio}
          onCancelar={() => setConfirmando(null)}
        />
      )}

      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <PenLine size={15} className="text-violet-600" /> Assinar pela plataforma
        </h2>
        <p className="text-xs text-gray-500">Cada signatário recebe um link, confirma código por e-mail, tira selfie e assina.</p>
      </div>

      {/* Novos signatários */}
      <div className="space-y-2 mb-3">
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
            <input value={l.nome} onChange={e => set(i, 'nome', e.target.value)} placeholder="Nome" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={l.email} onChange={e => set(i, 'email', e.target.value)} placeholder="E-mail (obrigatório)" className={`px-2.5 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${l.nome.trim() && !/\S+@\S+\.\S+/.test(l.email) ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`} />
            <input value={l.papel} onChange={e => set(i, 'papel', e.target.value)} placeholder="Papel (ex.: Locatário)" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button type="button" onClick={() => rem(i)} className="text-gray-300 hover:text-rose-600 p-1.5 justify-self-end"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"><Plus size={12} /> Adicionar signatário</button>
      </div>

      {/* Chips das partes do contrato (inclui testemunhas selecionadas) */}
      {sugestoes.filter(s => !linhas.some(l => l.nome.trim().toLowerCase() === s.nome.trim().toLowerCase())).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[11px] text-gray-400">Adicionar das partes:</span>
          {sugestoes
            .filter(s => !linhas.some(l => l.email.toLowerCase() === s.email.toLowerCase()))
            .map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLinhas(prev => [...prev.filter(l => l.nome.trim() || l.email.trim()), { nome: s.nome, email: s.email, papel: s.papel }])}
                className="text-[11px] bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full"
              >
                + {s.nome} <span className="text-violet-400">({s.papel})</span>
              </button>
            ))}
        </div>
      )}

      {/* Opção: exigir código (OTP) por e-mail */}
      <label className="flex items-start gap-2 cursor-pointer mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
        <input type="checkbox" checked={exigirOtp} onChange={e => setExigirOtp(e.target.checked)} className="mt-0.5 accent-violet-600 shrink-0" />
        <span>
          <span className="text-xs font-semibold text-gray-800">Exigir código por e-mail (OTP)</span>
          <span className="block text-[11px] text-gray-500 leading-tight mt-0.5">
            {exigirOtp
              ? 'Cada parte confirma um código enviado ao e-mail antes de assinar (mais seguro).'
              : 'Desmarcado: a pessoa assina só com selfie + assinatura (sem código). O e-mail ainda é registrado e recebe o contrato final quando todos assinarem.'}
          </span>
        </span>
      </label>

      {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}

      <button type="button" onClick={enviar} disabled={isPending} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar para assinatura
      </button>

      {/* Processos existentes */}
      {ativos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
          {ativos.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                  {p.status === 'concluido' ? 'Concluído' : 'Em assinatura'}
                </span>
                <span className="text-[10px] text-gray-400 flex-1">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                {p.status === 'concluido' ? (
                  <>
                    <a href={`/api/assinaturas/${p.id}/certificado`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-800" title="Só o certificado de assinatura, sem o contrato">
                      <ShieldCheck size={12} /> Certificado
                    </a>
                    <a href={`/api/assinaturas/${p.id}/pdf-final`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:text-green-800">
                      <Download size={12} /> Baixar assinado
                    </a>
                  </>
                ) : (
                  <>
                    {/* Prévia: dá pra provar quem já assinou sem esperar o processo fechar. */}
                    {p.signatarios.some(s => s.status === 'assinado') && (
                      <a href={`/api/assinaturas/${p.id}/certificado`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-800" title="Prévia com as assinaturas coletadas até agora">
                        <ShieldCheck size={12} /> Prévia do certificado
                      </a>
                    )}
                    <button type="button" onClick={() => cancelar(p.id)} className="text-red-400 hover:text-red-600 p-1" title="Cancelar"><X size={13} /></button>
                  </>
                )}
              </div>
              {/* Código público de autenticidade — o mesmo carimbado no rodapé do
                  PDF. Fica à mão pra ditar por telefone quando alguém liga
                  perguntando se o contrato é verdadeiro. */}
              {p.status === 'concluido' && p.codigo_validacao && (
                <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-500">
                  <span className="text-gray-400">Código de validação</span>
                  <span className="font-mono font-semibold text-gray-700">{p.codigo_validacao}</span>
                  <button
                    type="button"
                    onClick={() => copiarTexto(p.codigo_validacao!, `cod-${p.id}`)}
                    className="text-violet-600 hover:text-violet-800"
                    title="Copiar código"
                  >
                    {copiado === `cod-${p.id}` ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              )}

              <ul className="space-y-1.5">
                {p.signatarios.map(s => {
                  const pendente = s.status !== 'assinado' && p.status !== 'concluido'
                  return (
                    <li key={s.token} className="text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        {s.status === 'assinado'
                          ? <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                          : <Clock size={13} className="text-amber-500 shrink-0" />}
                        <span className="font-medium text-gray-800">{s.nome}</span>
                        <span className="text-gray-400 flex-1 truncate">{s.papel ? `· ${s.papel}` : ''}</span>
                        {reenviado === s.id && <span className="text-[10px] font-semibold text-green-600">enviado ✓</span>}
                        {pendente && (
                          <span className="flex items-center gap-0.5 shrink-0">
                            <button type="button" onClick={() => copiar(s.token)} className="text-violet-600 hover:text-violet-800 p-1" title="Copiar link">
                              {copiado === s.token ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            <button type="button" onClick={() => whatsapp(s)} className="text-green-600 hover:text-green-700 p-1" title="Enviar por WhatsApp">
                              <MessageCircle size={12} />
                            </button>
                            <button type="button" onClick={() => reenviar(s.id)} disabled={isPending} className="text-gray-500 hover:text-violet-700 p-1 disabled:opacity-50" title="Reenviar e-mail">
                              <Mail size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 pl-5">
                        {editId === s.id ? (
                          <>
                            <input
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              placeholder="e-mail correto"
                              className="flex-1 px-2 py-1 rounded border border-violet-300 text-[11px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            <button type="button" onClick={() => salvarEmail(s.id)} disabled={isPending} className="text-[10px] font-semibold bg-violet-700 hover:bg-violet-800 text-white px-2 py-1 rounded disabled:opacity-50">
                              {isPending ? '...' : 'Salvar e reenviar'}
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="text-[10px] text-gray-500">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-400 truncate">{s.email || '(sem e-mail)'}</span>
                            {pendente && (
                              <button type="button" onClick={() => { setEditId(s.id); setEditVal(s.email) }} className="text-gray-400 hover:text-violet-700 shrink-0" title="Corrigir e-mail">
                                <Pencil size={11} />
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Trilha de auditoria — o que prova a autoria da assinatura.
                          Vai igual no certificado anexo ao PDF final; aqui é só pra
                          o corretor conferir sem esperar todos assinarem. */}
                      {s.status === 'assinado' && (
                        <div className="mt-1.5 pl-5 flex items-start gap-2">
                          {s.selfie_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.selfie_url}
                              alt={`Selfie de ${s.nome}`}
                              className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          )}
                          <div className="text-[10px] leading-relaxed text-gray-500 min-w-0">
                            <div><span className="text-gray-400">Assinado em </span>{fmtDataHora(s.assinado_em)}</div>
                            <div>
                              <span className="text-gray-400">IP </span>{s.ip ?? '—'}
                              {resumirDispositivo(s.user_agent) && <> <span className="text-gray-400">· </span>{resumirDispositivo(s.user_agent)}</>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2">
                              {s.geo && (
                                <a
                                  href={`https://www.google.com/maps?q=${s.geo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-violet-600 hover:underline"
                                >
                                  ver localização
                                </a>
                              )}
                              <span className={s.otp_verificado ? 'text-green-600' : 'text-gray-400'}>
                                {s.otp_verificado ? 'código por e-mail confirmado' : 'sem código por e-mail'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
