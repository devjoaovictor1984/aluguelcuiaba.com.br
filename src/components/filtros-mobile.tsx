'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { FiltrosSidebar } from './filtros-sidebar'

export function FiltrosMobileDrawer({ count }: { count?: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <SlidersHorizontal size={14} />
        Filtros
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden rounded-t-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            {/* Handle bar + close */}
            <div className="bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                <SlidersHorizontal size={15} className="text-violet-600" />
                Filtros
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sidebar content (scrollable) */}
            <div className="overflow-y-auto flex-1 bg-white">
              <FiltrosSidebar inDrawer onClose={() => setOpen(false)} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
