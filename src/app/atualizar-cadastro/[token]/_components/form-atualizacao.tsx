'use client'

import { useState, useTransition } from 'react'
import { Upload, Loader2, Check, AlertCircle, FileText } from 'lucide-react'
import { comprimirImagem, formatarTamanho, PERFIL_DOCUMENTO } from '@/lib/imagens/comprimir'
import { TIPOS_IMOVEL } from '@/lib/constants'
import { LABEL_MOBILIADO, type CampoImovel } from '@/lib/crm/campos-imovel'
import { submitAtualizacaoCadastro } from '../actions'

export interface CampoExistente {
  chave: string
  label: string
  valorAtual: string
}

export interface TipoDoc {
  chave: string
  label: string
  /** Matrícula, contas, IPTU… — aparece no bloco do imóvel. */
  doImovel?: boolean
}

export type CampoImovelForm = CampoImovel & { valorAtual: string }

interface Props {
  token: string
  nomePessoa: string | null
  campos: CampoExistente[]
  camposImovel?: CampoImovelForm[]
  documentos: TipoDoc[]
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function FormAtualizacao({ token, nomePessoa, campos, camposImovel = [], documentos }: Props) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map(c => [c.chave, c.valorAtual ?? '']))
  )
  const [valoresImovel, setValoresImovel] = useState<Record<string, string>>(
    Object.fromEntries(camposImovel.map(c => [c.chave, c.valorAtual ?? '']))
  )
  const docsPessoa = documentos.filter(d => !d.doImovel)
  const docsImovel = documentos.filter(d => d.doImovel)
  // Grupos na ordem em que aparecem na lista de campos.
  const gruposImovel = camposImovel.reduce<{ titulo: string; campos: CampoImovelForm[] }[]>((acc, c) => {
    const g = acc.find(x => x.titulo === c.grupo)
    if (g) g.campos.push(c); else acc.push({ titulo: c.grupo, campos: [c] })
    return acc
  }, [])

  /** CEP do imóvel completo → preenche rua, bairro e cidade que estiverem vazios. */
  const buscarCepImovel = async (cep: string) => {
    const limpo = cep.replace(/\D/g, '')
    if (limpo.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const d = await res.json()
      if (d.erro) return
      setValoresImovel(s => ({
        ...s,
        ...('imovel_endereco_logradouro' in s && !s.imovel_endereco_logradouro && d.logradouro ? { imovel_endereco_logradouro: d.logradouro } : {}),
        ...('imovel_endereco_bairro' in s && !s.imovel_endereco_bairro && d.bairro ? { imovel_endereco_bairro: d.bairro } : {}),
        ...('imovel_endereco_cidade' in s && !s.imovel_endereco_cidade && d.localidade ? { imovel_endereco_cidade: `${d.localidade}/${d.uf}` } : {}),
      }))
    } catch {
      // Sem ViaCEP ela digita; não vale travar o formulário por isso.
    }
  }
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({})
  const [preparando, setPreparando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<'idle' | 'sucesso' | 'erro'>('idle')
  const [msgErro, setMsgErro] = useState('')

  // Tudo vai num POST só. A Vercel corta o corpo da requisição em 4,5MB e
  // isso não é configurável, então guardamos uma folga pros campos de texto.
  const LIMITE_TOTAL = 4 * 1024 * 1024
  const totalBytes = Object.values(arquivos).reduce((s, f) => s + (f?.size ?? 0), 0)
  const passouDoLimite = totalBytes > LIMITE_TOTAL

  /** Foto de celular chega com 4 a 10MB; reduz antes de guardar no estado. */
  const escolherArquivo = async (chave: string, f: File | null) => {
    if (!f) { setArquivos(s => ({ ...s, [chave]: null })); return }
    setPreparando(chave)
    try {
      const pronto = await comprimirImagem(f, PERFIL_DOCUMENTO)
      setArquivos(s => ({ ...s, [chave]: pronto }))
    } finally {
      setPreparando(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('idle')
    setMsgErro('')
    if (passouDoLimite) {
      setEstado('erro')
      setMsgErro(
        `Os arquivos somam ${formatarTamanho(totalBytes)} e o limite por envio é 4 MB. ` +
        'Envie fotos em vez de PDF pesado, ou peça um novo link pro restante dos documentos.',
      )
      return
    }
    const fd = new FormData()
    for (const c of campos) fd.set(c.chave, valores[c.chave] ?? '')
    for (const c of camposImovel) fd.set(c.chave, valoresImovel[c.chave] ?? '')
    for (const d of documentos) {
      const f = arquivos[d.chave]
      if (f) fd.set(`doc_${d.chave}`, f)
    }
    startTransition(async () => {
      try {
        const r = await submitAtualizacaoCadastro(token, fd)
        if (r.error) { setEstado('erro'); setMsgErro(r.error); return }
        setEstado('sucesso')
      } catch {
        // Sem este catch a falha sobe pro error boundary e o cliente vê
        // "Algo deu errado", sem saber o que fazer nem se algo foi salvo.
        setEstado('erro')
        setMsgErro(
          'Não consegui enviar. Pode ter sido a conexão ou o tamanho dos arquivos. ' +
          'Tente de novo; se insistir, envie um documento por vez.',
        )
      }
    })
  }

  if (estado === 'sucesso') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Obrigado!</h2>
        <p className="text-sm text-gray-500">Seu cadastro foi atualizado. Pode fechar esta página.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {nomePessoa && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs text-violet-900">
          Cadastro de <strong>{nomePessoa}</strong>
        </div>
      )}

      {campos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {camposImovel.length > 0 ? 'Seus dados' : 'Dados solicitados'}
          </h2>
          {campos.map(c => (
            <Campo
              key={c.chave}
              label={c.label}
              chave={c.chave}
              valor={valores[c.chave] ?? ''}
              onChange={v => setValores(s => ({ ...s, [c.chave]: v }))}
            />
          ))}
        </section>
      )}

      {docsPessoa.length > 0 && (
        <SecaoDocumentos
          titulo={camposImovel.length > 0 || docsImovel.length > 0 ? 'Seus documentos' : 'Documentos solicitados'}
          documentos={docsPessoa}
          arquivos={arquivos}
          preparando={preparando}
          onEscolher={escolherArquivo}
        />
      )}

      {camposImovel.length > 0 && (
        <section className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dados do imóvel</h2>
            <p className="text-[11px] text-gray-500">
              Preencha o que tiver em mãos. Os números estão na matrícula, no
              carnê do IPTU e nas contas de luz, água e gás.
            </p>
          </div>
          {gruposImovel.map(g => (
            <div key={g.titulo} className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">{g.titulo}</p>
              {g.campos.map(c => (
                <CampoImovelInput
                  key={c.chave}
                  campo={c}
                  valor={valoresImovel[c.chave] ?? ''}
                  onChange={v => {
                    setValoresImovel(s => ({ ...s, [c.chave]: v }))
                    if (c.formato === 'cep') void buscarCepImovel(v)
                  }}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {docsImovel.length > 0 && (
        <SecaoDocumentos
          titulo="Documentos do imóvel"
          documentos={docsImovel}
          arquivos={arquivos}
          preparando={preparando}
          onEscolher={escolherArquivo}
        />
      )}

      {totalBytes > 0 && (
        <p className={`text-[11px] ${passouDoLimite ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
          Total dos arquivos: {formatarTamanho(totalBytes)}
          {passouDoLimite && ' — acima do limite de 4 MB por envio.'}
        </p>
      )}

      {estado === 'erro' && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !!preparando || passouDoLimite}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {isPending ? 'Enviando...' : 'Enviar cadastro'}
      </button>
    </form>
  )
}

function SecaoDocumentos({
  titulo, documentos, arquivos, preparando, onEscolher,
}: {
  titulo: string
  documentos: TipoDoc[]
  arquivos: Record<string, File | null>
  preparando: string | null
  onEscolher: (chave: string, f: File | null) => Promise<void>
}) {
  return (
    <section className="space-y-3 pt-2 border-t border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
      <p className="text-[11px] text-gray-500">
        JPG, PNG, WEBP, HEIC ou PDF. As fotos são reduzidas aqui mesmo, no
        seu aparelho, antes de subir.
      </p>
      {documentos.map(d => (
        <UploadCampo
          key={d.chave}
          label={d.label}
          arquivo={arquivos[d.chave] ?? null}
          preparando={preparando === d.chave}
          onChange={f => void onEscolher(d.chave, f)}
        />
      ))}
    </section>
  )
}

function CampoImovelInput({
  campo, valor, onChange,
}: { campo: CampoImovelForm; valor: string; onChange: (v: string) => void }) {
  const dica = campo.dica && <span className="text-[11px] text-gray-400 block mt-0.5">{campo.dica}</span>

  if (campo.formato === 'tipo' || campo.formato === 'mobiliado') {
    const opcoes: { value: string; label: string }[] = campo.formato === 'tipo'
      ? TIPOS_IMOVEL.map(t => ({ value: t.value, label: t.label }))
      : Object.entries(LABEL_MOBILIADO).map(([value, label]) => ({ value, label }))
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{campo.label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {dica}
      </label>
    )
  }
  if (campo.formato === 'longo') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{campo.label}</span>
        <textarea value={valor} onChange={e => onChange(e.target.value)} rows={3} maxLength={2000} className={inputCls} />
        {dica}
      </label>
    )
  }
  const inputMode = campo.formato === 'numero' ? 'decimal'
    : campo.formato === 'inteiro' || campo.formato === 'cep' ? 'numeric'
    : undefined
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 block mb-1">{campo.label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={valor}
        onChange={e => onChange(e.target.value)}
        maxLength={campo.formato === 'cep' ? 9 : 300}
        className={inputCls}
        placeholder={campo.formato === 'numero' ? '0,00' : campo.label}
      />
      {dica}
    </label>
  )
}

function Campo({
  label, chave, valor, onChange,
}: {
  label: string; chave: string; valor: string; onChange: (v: string) => void
}) {
  const tipo = chave === 'email' ? 'email'
    : chave === 'data_nascimento' ? 'date'
    : 'text'

  if (chave === 'estado_civil') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="solteiro">Solteiro(a)</option>
          <option value="casado">Casado(a)</option>
          <option value="divorciado">Divorciado(a)</option>
          <option value="viuvo">Viúvo(a)</option>
          <option value="uniao_estavel">União estável</option>
        </select>
      </label>
    )
  }
  if (chave === 'banco_tipo_conta') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="corrente">Corrente</option>
          <option value="poupanca">Poupança</option>
        </select>
      </label>
    )
  }
  if (chave === 'pix_tipo') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="aleatoria">Chave aleatória</option>
        </select>
      </label>
    )
  }

  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
      <input
        type={tipo}
        value={valor}
        onChange={e => onChange(e.target.value)}
        className={inputCls}
        placeholder={label}
      />
    </label>
  )
}

function UploadCampo({
  label, arquivo, preparando, onChange,
}: { label: string; arquivo: File | null; preparando: boolean; onChange: (f: File | null) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      {preparando ? (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin shrink-0" />
          Preparando o arquivo…
        </div>
      ) : arquivo ? (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-sm">
          <FileText size={14} className="text-violet-700 shrink-0" />
          <span className="flex-1 truncate text-violet-900">{arquivo.name}</span>
          <span className="text-[11px] text-violet-500 shrink-0">{formatarTamanho(arquivo.size)}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Remover
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-xl px-3 py-3 cursor-pointer">
          <Upload size={14} className="text-gray-400" />
          <span className="text-xs text-gray-600">Selecionar arquivo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={e => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  )
}
