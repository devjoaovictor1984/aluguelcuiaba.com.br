import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ShieldCheck, ShieldX, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizarCodigo } from '@/lib/crm/validacao-codigo'
import { ConferirArquivo } from './_components/conferir-arquivo'

export const metadata: Metadata = {
  title: 'Resultado da validação — AluguelCuiabá',
  // Resultado é sobre um contrato específico: não deve ser indexado nem
  // aparecer em busca. Quem tem o código chega direto.
  robots: { index: false, follow: false },
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : '—'

export default async function ResultadoValidacaoPage({
  params,
}: { params: Promise<{ codigo: string }> }) {
  const { codigo: bruto } = await params
  const codigo = normalizarCodigo(decodeURIComponent(bruto))

  const admin = createAdminClient()
  const { data: proc } = codigo
    ? await admin
        .from('contrato_assinaturas')
        .select('id, titulo, tipo_contrato, status, concluido_em, pdf_hash, pdf_final_hash, user_id')
        .eq('codigo_validacao', codigo)
        .maybeSingle()
    : { data: null }

  // Só processo concluído recebe código; qualquer outro estado é inválido aqui.
  const valido = !!proc && proc.status === 'concluido'

  const { data: perfil } = valido
    ? await admin.from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()
    : { data: null }

  const { data: partes } = valido
    ? await admin
        .from('contrato_assinatura_signatarios')
        .select('nome, papel, assinado_em, ordem')
        .eq('assinatura_id', proc.id)
        .order('ordem', { ascending: true })
    : { data: null }

  return (
    <>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10 pb-20">
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
          <Link href="/" className="hover:text-violet-600 transition-colors">Início</Link>
          <ChevronRight size={12} />
          <Link href="/validar" className="hover:text-violet-600 transition-colors">Validar contrato</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600">Resultado</span>
        </nav>

        {!valido || !proc ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <ShieldX size={20} className="text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Código não encontrado</h1>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              Não existe contrato assinado com o código{' '}
              <span className="font-mono font-semibold">{codigo || bruto}</span>.
            </p>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Confira se digitou exatamente como está no rodapé do documento. Os caracteres
              O, I, L, S, Z, B, 0, 1, 5 e 8 não aparecem nos códigos — se leu algum deles,
              provavelmente é o parecido (0/O, 1/I, 5/S, 8/B).
            </p>
            <Link href="/validar" className="inline-block mt-5 text-sm font-semibold text-violet-700 hover:text-violet-800">
              Tentar outro código
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-green-50 rounded-2xl border border-green-200 p-6 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-green-900">Documento autêntico</h1>
                  <p className="text-xs text-green-700">
                    Assinado eletronicamente por todas as partes nesta plataforma.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <dl className="text-sm space-y-2.5">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-400 w-32 shrink-0">Documento</dt>
                  <dd className="font-semibold text-gray-900">{proc.titulo ?? 'Contrato'}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-400 w-32 shrink-0">Tipo</dt>
                  <dd className="text-gray-700">
                    {proc.tipo_contrato === 'administracao' ? 'Contrato de Administração' : 'Contrato de Locação'}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-400 w-32 shrink-0">Emitido por</dt>
                  <dd className="text-gray-700">{perfil?.razao_social || perfil?.nome || 'AluguelCuiabá'}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-400 w-32 shrink-0">Concluído em</dt>
                  <dd className="text-gray-700">{fmt(proc.concluido_em)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-400 w-32 shrink-0">Código</dt>
                  <dd className="font-mono text-gray-700">{codigo}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                Assinaram ({partes?.length ?? 0})
              </h2>
              <ul className="space-y-2">
                {(partes ?? []).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-medium text-gray-800">{s.nome}</span>
                      {s.papel && <span className="text-gray-400"> · {s.papel}</span>}
                      <div className="text-[11px] text-gray-400">{fmt(s.assinado_em)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Só com a via congelada (v84) existe um hash que a pessoa consegue
                reproduzir no arquivo dela. Antes disso, não há o que conferir. */}
            {proc.pdf_final_hash && <ConferirArquivo hashEsperado={proc.pdf_final_hash} />}

            {(proc.pdf_final_hash || proc.pdf_hash) && (
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
                {proc.pdf_final_hash && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">SHA-256 da via assinada (arquivo completo)</p>
                    <p className="font-mono text-[10px] text-gray-700 break-all">{proc.pdf_final_hash}</p>
                  </div>
                )}
                {proc.pdf_hash && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">SHA-256 do contrato, sem o certificado anexo</p>
                    <p className="font-mono text-[10px] text-gray-700 break-all">{proc.pdf_hash}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Esta consulta confirma a existência e a autoria do documento. A trilha de auditoria
              completa — selfie, e-mail, IP, dispositivo e localização de cada signatário — está no
              certificado de assinatura anexo ao contrato, entregue apenas às partes.
            </p>
          </>
        )}
      </div>

      <Footer />
    </>
  )
}
