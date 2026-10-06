"use client"

import React, { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Clapperboard } from "lucide-react"
import { PictoriumRoot } from "@/lib/context"
import { ToastProvider } from "@/components/Toast"
import { AmbientBackground } from "@/components/AmbientBackground"
import { useT } from "@/lib/contexts/TranslationContext"
import { DesktopSidebar } from "@/components/DesktopSidebar"
import { MobileDock } from "@/components/MobileDock"
import { JellyfinLibrary } from "@/components/JellyfinLibrary"

const PinLockModal = dynamic(() => import("@/components/PinLockModal").then((m) => m.PinLockModal), { ssr: false })

type Gate = "checking" | "locked" | "open"

function JellyfinContent() {
  const { t } = useT()
  const [gate, setGate] = useState<Gate>("checking")

  // Same PIN session the rest of the app uses: when an admin PIN is configured and
  // this browser has no session yet, show the lock modal before touching /api/jellyfin.
  useEffect(() => {
    fetch("/api/auth/pin", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setGate(data && data.hasPin && !data.authenticated ? "locked" : "open"))
      .catch(() => setGate("open"))
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <AmbientBackground />
      <DesktopSidebar />
      <ToastProvider>
        <div className="relative z-10 max-w-[1680px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 md:pt-14 lg:pt-16 pb-24 md:pb-8 md:pl-20">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-3.5 py-2 rounded-xl cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("ui.back") || "Back"}</span>
            </Link>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-orange/15 border border-accent-orange/30 flex items-center justify-center shrink-0 shadow-lg shadow-accent-orange/10">
              <Clapperboard className="w-6 h-6 text-accent-orange" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">Jellyfin posters</h1>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                Everything in your Jellyfin library. Open a title, edit its poster, and send it back to Jellyfin.
              </p>
            </div>
          </div>

          {gate === "open" && <JellyfinLibrary />}
        </div>
      </ToastProvider>
      <MobileDock />
      {gate === "locked" && <PinLockModal onSuccess={() => setGate("open")} />}
    </div>
  )
}

export default function JellyfinPage() {
  return (
    <PictoriumRoot>
      <JellyfinContent />
    </PictoriumRoot>
  )
}
