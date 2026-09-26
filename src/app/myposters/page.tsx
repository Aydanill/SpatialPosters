"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PictoriumRoot } from "@/lib/context"
import { MyPostersView } from "@/components/MyPostersView"
import { ToastProvider } from "@/components/Toast"
import { AmbientBackground } from "@/components/AmbientBackground"
import { useT } from "@/lib/contexts/TranslationContext"
import { setLang, getLang } from "@/lib/i18n"

function MyPostersContent() {
  const { t } = useT()

  const [, setLangTick] = useState(0)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("preferred_lang")
      if (saved && saved !== getLang()) {
        setLang(saved)
        setLangTick((n) => n + 1)
      }
    } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <AmbientBackground />
      <ToastProvider>
        <div className="relative z-10 max-w-[1680px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Top navigation bar */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-3.5 py-2 rounded-xl cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("ui.back") || "Torna alla Home"}</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.04] px-3 py-1 rounded-lg border border-white/[0.08]">
                {t("ui.myPosters") || "SpatialPosters"}
              </span>
            </div>
          </div>

          {/* Main My Posters View */}
          <MyPostersView />
        </div>
      </ToastProvider>
    </div>
  )
}

export default function MyPostersPage() {
  return (
    <PictoriumRoot>
      <MyPostersContent />
    </PictoriumRoot>
  )
}
