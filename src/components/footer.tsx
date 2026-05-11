import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

const ANO = new Date().getFullYear()

async function getSiteConfig() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('site_config').select('chave, valor')
    return Object.fromEntries((data ?? []).map(c => [c.chave, c.valor ?? '']))
  } catch {
    return {}
  }
}

export async function Footer() {
  const cfg = await getSiteConfig()
  const email = cfg.contato_email || 'contato@aluguelcuiaba.com.br'
  const whatsapp = cfg.contato_whatsapp || '5565999999999'
  const logo = cfg.logo_url || '/logo.png'
  const instagram = cfg.instagram_url || 'https://instagram.com/aluguelcuiaba'
  const facebook = cfg.facebook_url || 'https://facebook.com/aluguelcuiaba'

  const whatsappFormatado = whatsapp.replace(/^55(\d{2})9?(\d{4})(\d{4})$/, '($1) 9 $2-$3') || whatsapp

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">

      {/* Corpo principal */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Coluna 1 — marca */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex mb-4">
              <Image
                src={logo}
                alt="AluguelCuiabá"
                width={180}
                height={26}
                className="h-7 w-auto brightness-0 invert"
                unoptimized
              />
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              O portal especializado em aluguel de imóveis em Cuiabá/MT. Conectamos proprietários e inquilinos de forma simples, rápida e sem burocracia.
            </p>
            <div className="flex items-center gap-1.5 mt-4 text-sm text-gray-400">
              <MapPin size={14} className="text-violet-400 shrink-0" />
              Cuiabá — Mato Grosso, Brasil
            </div>
          </div>

          {/* Coluna 2 — imóveis */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Imóveis</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/?tipo=apartamento" className="hover:text-violet-400 transition-colors">Apartamentos para alugar</Link></li>
              <li><Link href="/?tipo=casa" className="hover:text-violet-400 transition-colors">Casas para alugar</Link></li>
              <li><Link href="/?tipo=kitnet" className="hover:text-violet-400 transition-colors">Kitnets e Studios</Link></li>
              <li><Link href="/?tipo=comercial" className="hover:text-violet-400 transition-colors">Imóveis comerciais</Link></li>
              <li><Link href="/?tipo=terreno" className="hover:text-violet-400 transition-colors">Terrenos</Link></li>
            </ul>
          </div>

          {/* Coluna 3 — portal */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Portal</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/painel/anuncios/novo" className="hover:text-violet-400 transition-colors">Anunciar imóvel grátis</Link></li>
              <li><Link href="/painel" className="hover:text-violet-400 transition-colors">Meu painel</Link></li>
              <li><Link href="/entrar" className="hover:text-violet-400 transition-colors">Entrar</Link></li>
              <li><Link href="/blog" className="hover:text-violet-400 transition-colors">Blog</Link></li>
            </ul>
            <h3 className="text-white font-semibold text-sm mb-4 mt-6 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/termos" className="hover:text-violet-400 transition-colors">Termos de uso</Link></li>
              <li><Link href="/privacidade" className="hover:text-violet-400 transition-colors">Política de privacidade</Link></li>
            </ul>
          </div>

          {/* Coluna 4 — contato */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Contato</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-green-400 transition-colors"
                >
                  <Phone size={14} className="text-green-400 shrink-0" />
                  {whatsappFormatado}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 hover:text-violet-400 transition-colors"
                >
                  <Mail size={14} className="text-violet-400 shrink-0" />
                  {email}
                </a>
              </li>
            </ul>

            <h3 className="text-white font-semibold text-sm mb-3 mt-6 uppercase tracking-wider">Redes sociais</h3>
            <div className="flex gap-3">
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-violet-700 flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
              <a
                href={facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-violet-700 flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>
            © {ANO} AluguelCuiabá.com.br — Todos os direitos reservados.
          </p>
          <a
            href="https://www.joaovictorvieira.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-violet-400 transition-colors"
          >
            Desenvolvido por <span className="text-violet-400 font-medium">Agência JVV</span>
          </a>
        </div>
      </div>

    </footer>
  )
}
