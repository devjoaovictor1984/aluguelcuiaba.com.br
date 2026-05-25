'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Link as LinkIcon, Copy, Check, Loader2, MessageCircle, Mail,
  Trash2, AlertCircle, Clock, CheckCircle2, Send,
} from 'lucide-react'
import { gerarLinkAtualizacao, revogarLinkAtualizacao } from '../actions-solicitacao'

interface CampoOpt { chave: string; label: string }

const CAMPOS_GRUPOS: { titulo: string; campos: CampoOpt[] }[] = [
  {
    titulo: 'Dados pessoais',
    campos: [
      { chave: 'nome', label: 'Nome' },
      { chave: 'cpf_cnpj', label: 'CPF/CNPJ' },
      { chave: 'rg', label: 'RG (número)' },
      { chave: 'rg_orgao_emissor', label: 'Órgão emissor RG' },
      { chave: 'rg_uf', label: 'UF do RG' },
      { chave: 'data_nascimento', label: 'Data de nascimento' },
      { chave: 'naturalidade', label: 'Naturalidade' },
      { chave: 'estado_civil', label: 'Estado civil' },
      { chave: 'regime_bens', label: 'Regime de bens (se casado)' },
      { chave: 'profissao', label: 'Profissão' },
      { chave: 'renda_mensal', label: 'Renda mensal' },
      { chave: 'nacionalidade', label: 'Nacionalidade' },
      { chave: 'nome_pai', label: 'Nome do pai' },
      { chave: 'nome_mae', label: 'Nome da mãe' },
    ],
  },
  {
    titulo: 'Cônjuge (se casado)',
    campos: [
      { chave: 'conjuge_nome', label: 'Nome do cônjuge' },
      { chave: 'conjuge_cpf', label: 'CPF do cônjuge' },
      { chave: 'conjuge_rg', label: 'RG do cônjuge' },
      { chave: 'conjuge_rg_orgao', label: 'Órgão emissor RG cônjuge' },
      { chave: 'conjuge_data_nascimento', label: 'Data nasc. do cônjuge' },
      { chave: 'conjuge_profissao', label: 'Profissão do cônjuge' },
      { chave: 'conjuge_nacionalidade', label: 'Nacionalidade do cônjuge' },
    ],
  },
  {
    titulo: 'Contato',
    campos: [
      { chave: 'email', label: 'E-mail' },
      { chave: 'telefone', label: 'Telefone' },
      { chave: 'whatsapp', label: 'WhatsApp' },
    ],
  },
  {
    titulo: 'Endereço',
    campos: [
      { chave: 'endereco_cep', label: 'CEP' },
      { chave: 'endereco_logradouro', label: 'Logradouro' },
      { chave: 'endereco_numero', label: 'Número' },
      { chave: 'endereco_complemento', label: 'Complemento' },
      { chave: 'endereco_bairro', label: 'Bairro' },
      { chave: 'endereco_cidade', label: 'Cidade' },
      { chave: 'endereco_estado', label: 'UF' },
    ],
  },
  {
    titulo: 'Recebimento (PIX/banco)',
    campos: [
      { chave: 'pix_tipo', label: 'Tipo PIX' },
      { chave: 'pix_chave', label: 'Chave PIX' },
      { chave: 'banco_nome', label: 'Banco' },
      { chave: 'banco_agencia', label: 'Agência' },
      { chave: 'banco_conta', label: 'Conta' },
      { chave: 'banco_titular', label: 'Titular' },
    ],
  },
]

const DOCS: CampoOpt[] = [
  { chave: 'rg', label: 'RG' },
  { chave: 'cpf', label: 'CPF' },
  { chave: 'cnh', label: 'CNH' },
  { chave: 'comprovante_residencia', label: 'Comprovante de residência' },
  { chave: 'comprovante_renda', label: 'Comprovante de renda' },
  { chave: 'contracheque', label: 'Contracheque' },
  { chave: 'extrato_bancario', label: 'Extrato bancário' },
  { chave: 'imposto_renda', label: 'IR' },
  { chave: 'certidao_casamento', label: 'Certidão casamento' },
  { chave: 'foto', label: 'Foto' },
]

const PRESETS: { nome: string; campos: string[]; docs: string[] }[] = [
  {
    nome: 'Cadastro completo de inquilino',
    campos: [
      'nome','cpf_cnpj','rg','rg_orgao_emissor','rg_uf','data_nascimento','naturalidade',
      'estado_civil','regime_bens','profissao','renda_mensal','nacionalidade','nome_pai','nome_mae',
      'email','telefone','whatsapp',
      'endereco_cep','endereco_logradouro','endereco_numero','endereco_complemento','endereco_bairro','endereco_cidade','endereco_estado',
    ],
    docs: ['rg','cpf','comprovante_residencia','comprovante_renda'],
  },
  {
    nome: 'Inquilino casado (com cônjuge)',
    campos: [
      'nome','cpf_cnpj','rg','rg_orgao_emissor','rg_uf','data_nascimento','naturalidade',
      'estado_civil','regime_bens','profissao','renda_mensal','nacionalidade','nome_pai','nome_mae',
      'email','telefone','whatsapp',
      'endereco_cep','endereco_logradouro','endereco_numero','endereco_complemento','endereco_bairro','endereco_cidade','endereco_estado',
      'conjuge_nome','conjuge_cpf','conjuge_rg','conjuge_rg_orgao','conjuge_data_nascimento','conjuge_profissao','conjuge_nacionalidade',
    ],
    docs: ['rg','cpf','comprovante_residencia','comprovante_renda','certidao_casamento'],
  },
  {
    nome: 'Só dados bancários (proprietário)',
    campos: ['pix_tipo','pix_chave','banco_nome','banco_agencia','banco_conta','banco_titular'],
    docs: [],
  },
  {
    nome: 'Só documentos',
    campos: [],
    docs: ['rg','cpf','comprovante_residencia','comprovante_renda'],
  },
]

export interface SolicitacaoAtiva {
  id: string
  token: string
  campos: string[]
  tipos_documento: string[]
  expira_em: string
  preenchido_em: string | null
  revogado_em: string | null
  created_at: string
}

interface Props {
  pessoaId: string
  nomePessoa: string
  telefoneWhatsapp: string | null
  emailPessoa: string | null
  baseUrl: string
  solicitacoes: SolicitacaoAtiva[]
}

export function BlocoSolicitacao({ pessoaId, nomePessoa, telefoneWhatsapp, emailPessoa, baseUrl, solicitacoes }: Props) {
  const router = useRouter()
  const [campos, setCampos] = useState<Set<string>>(new Set())
  const [docs, setDocs] = useState<Set<string>>(new Set())
  const [horas, setHoras] = useState(24)
  const [isPending, startTransition] = useTransition()
  const [novoLink, setNovoLink] = useState<{ url: string; expira: string } | null>(null)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, chave: string) => {
    const novo = new Set(set)
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave)
    setSet(novo)
  }

  const aplicarPreset = (p: typeof PRESETS[number]) => {
    setCampos(new Set(p.campos))
    setDocs(new Set(p.docs))
  }

  const gerar = () => {
    setErro('')
    setNovoLink(null)
    if (campos.size === 0 && docs.size === 0) {
      setErro('Selecione pelo menos 1 campo ou documento.')
      return
    }
    startTransition(async () => {
      const r = await gerarLinkAtualizacao({
        pessoa_id: pessoaId,
        campos: Array.from(campos),
        tipos_documento: Array.from(docs),
        horas_validade: horas,
      })
      if (r.error) { setErro(r.error); return }
      const url = r.url || `${baseUrl}/atualizar-cadastro/${r.token}`
      setNovoLink({ url, expira: r.expira_em ?? '' })
      router.refresh()
    })
  }

  const copiar = async () => {
    if (!novoLink) return
    try {
      await navigator.clipboard.writeText(novoLink.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert('Não consegui copiar — selecione o link manualmente.')
    }
  }

  const compartilharWhatsapp = () => {
    if (!novoLink) return
    const msg = `Olá ${nomePessoa.split(' ')[0]}, precisamos completar seu cadastro. Acesse o link abaixo (válido por ${horas}h):\n\n${novoLink.url}`
    const fone = (telefoneWhatsapp ?? '').replace(/\D/g, '')
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const compartilharEmail = () => {
    if (!novoLink) return
    const assunto = `Atualização do cadastro — válido por ${horas}h`
    const corpo = `Olá ${nomePessoa},\n\nPrecisamos completar seu cadastro. Acesse o link abaixo (expira em ${horas}h):\n\n${novoLink.url}\n\nObrigado!`
    const to = emailPessoa ? `?to=${emailPessoa}&` : '?'
    window.open(`mailto:${emailPessoa ?? ''}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`, '_blank')
  }

  const revogar = (id: string) => {
    if (!confirm('Cancelar este link de atualização? A pessoa não conseguirá mais usar.')) return
    startTransition(async () => {
      const r = await revogarLinkAtualizacao(id)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  const totalSelecionado = campos.size + docs.size

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
          <Send size={16} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">Pedir atualização do cadastro</h2>
          <p className="text-xs text-gray-500">
            Gera um link com validade configurável para a pessoa preencher os dados/documentos selecionados. O convidado não precisa ter conta.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESETS.map(p => (
          <button
            key={p.nome}
            type="button"
            onClick={() => aplicarPreset(p)}
            className="text-[11px] bg-gray-50 hover:bg-violet-50 hover:text-violet-700 border border-gray-200 hover:border-violet-200 px-2.5 py-1 rounded-full transition-colors"
          >
            {p.nome}
          </button>
        ))}
      </div>

      {/* Campos */}
      <div className="space-y-3 mb-4">
        {CAMPOS_GRUPOS.map(g => (
          <div key={g.titulo}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{g.titulo}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.campos.map(c => {
                const sel = campos.has(c.chave)
                return (
                  <button
                    key={c.chave}
                    type="button"
                    onClick={() => toggle(campos, setCampos, c.chave)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      sel
                        ? 'bg-violet-700 border-violet-700 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                    }`}
                  >
                    {sel && <Check size={11} className="inline-block mr-0.5" />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Documentos para envio</p>
          <div className="flex flex-wrap gap-1.5">
            {DOCS.map(d => {
              const sel = docs.has(d.chave)
              return (
                <button
                  key={d.chave}
                  type="button"
                  onClick={() => toggle(docs, setDocs, d.chave)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    sel
                      ? 'bg-violet-700 border-violet-700 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                  }`}
                >
                  {sel && <Check size={11} className="inline-block mr-0.5" />}
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Validade:
          <select
            value={horas}
            onChange={e => setHoras(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value={24}>24 horas</option>
            <option value={48}>48 horas</option>
            <option value={72}>3 dias</option>
            <option value={168}>7 dias</option>
          </select>
        </label>
        <span className="text-[11px] text-gray-400">
          {totalSelecionado} {totalSelecionado === 1 ? 'item' : 'itens'} selecionado{totalSelecionado === 1 ? '' : 's'}
        </span>
      </div>

      {erro && (
        <p className="flex items-center gap-1 text-xs text-red-600 mb-3">
          <AlertCircle size={12} /> {erro}
        </p>
      )}

      <button
        type="button"
        onClick={gerar}
        disabled={isPending || totalSelecionado === 0}
        className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
        Gerar link
      </button>

      {novoLink && (
        <div className="mt-4 bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 mb-1">Link gerado</p>
            <p className="text-xs text-gray-700 break-all font-mono bg-white border border-violet-100 rounded-lg p-2">
              {novoLink.url}
            </p>
            {novoLink.expira && (
              <p className="text-[11px] text-violet-700 mt-1.5 flex items-center gap-1">
                <Clock size={11} /> Expira em {new Date(novoLink.expira).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiar}
              className="flex items-center gap-1 text-xs bg-white hover:bg-gray-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-lg"
            >
              {copiado ? <Check size={11} /> : <Copy size={11} />}
              {copiado ? 'Copiado!' : 'Copiar link'}
            </button>
            <button
              type="button"
              onClick={compartilharWhatsapp}
              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg"
            >
              <MessageCircle size={11} /> WhatsApp
            </button>
            <button
              type="button"
              onClick={compartilharEmail}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
            >
              <Mail size={11} /> E-mail
            </button>
          </div>
        </div>
      )}

      {/* Lista de solicitações */}
      {solicitacoes.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Histórico de solicitações</p>
          <ul className="space-y-1.5">
            {solicitacoes.map(s => {
              const expirado = !s.preenchido_em && !s.revogado_em && new Date(s.expira_em).getTime() < Date.now()
              const status =
                s.preenchido_em ? { label: 'preenchido', cor: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={11} /> }
                : s.revogado_em ? { label: 'cancelado', cor: 'bg-gray-100 text-gray-600', icon: null }
                : expirado ? { label: 'expirado', cor: 'bg-red-100 text-red-700', icon: null }
                : { label: 'ativo', cor: 'bg-violet-100 text-violet-700', icon: <Clock size={11} /> }
              const ativo = !s.preenchido_em && !s.revogado_em && !expirado
              return (
                <li key={s.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.cor}`}>
                    {status.icon}
                    {status.label}
                  </span>
                  <span className="text-gray-700">
                    {s.campos.length} campo{s.campos.length === 1 ? '' : 's'} · {s.tipos_documento.length} doc{s.tipos_documento.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-gray-400 flex-1">
                    criado {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    {!s.preenchido_em && !s.revogado_em && ` · expira ${new Date(s.expira_em).toLocaleDateString('pt-BR')}`}
                  </span>
                  {ativo && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${baseUrl}/atualizar-cadastro/${s.token}`)
                            .then(() => alert('Link copiado'))
                            .catch(() => alert('Falha ao copiar'))
                        }}
                        title="Copiar link"
                        className="text-violet-600 hover:text-violet-700 p-1"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => revogar(s.id)}
                        title="Cancelar link"
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
