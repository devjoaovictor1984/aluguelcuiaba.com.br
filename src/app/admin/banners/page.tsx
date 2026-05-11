import { createAdminClient } from '@/lib/supabase/admin'
import { BannerUpload } from './_components/banner-upload'
import { BannerList } from './_components/banner-list'
import { LayoutList } from 'lucide-react'

export default async function AdminBannersPage() {
  const supabase = createAdminClient()
  const { data: banners } = await supabase
    .from('banners_sidebar')
    .select('id, imagem_url, link_url, ordem, ativo')
    .order('ordem')

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutList size={20} className="text-violet-600" />
            Banners da sidebar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Até 10 imagens · rotacionam a cada 5s · 1080×1080 recomendado
          </p>
        </div>
        {(banners?.length ?? 0) < 10 && <BannerUpload />}
      </div>

      <BannerList banners={banners ?? []} />

      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
        <strong>Atenção:</strong> Para ativar esta funcionalidade, execute no Supabase SQL Editor:
        <pre className="mt-2 bg-amber-100 rounded p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS banners_sidebar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imagem_url TEXT NOT NULL,
  link_url TEXT,
  ordem SMALLINT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE banners_sidebar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_banners" ON banners_sidebar
  FOR SELECT TO anon, authenticated USING (ativo = true);`}
        </pre>
      </div>
    </div>
  )
}
