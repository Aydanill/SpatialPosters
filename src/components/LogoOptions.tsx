"use client"

import React, { useEffect, useState } from "react"
import type { TMDBImage } from "@/lib/types"
import { LANG_NAMES, groupBy, limitBest, posterUrl } from "@/lib/utils"
import { useT } from "@/lib/contexts/TranslationContext"
import { usePosterEditor } from "@/lib/contexts/PosterEditorContext"
import { Check, Plus, Trash2, ChevronDown, Link as LinkIcon } from "lucide-react"

interface Props {
  logos: TMDBImage[]
  selectedLogo: TMDBImage | null
  lang: string
  selectLogo: (img: TMDBImage) => void
  removeLogo: () => void
  disabled?: boolean
}

export const LogoOptions = React.memo(function LogoOptions({ logos, selectedLogo, lang, selectLogo, removeLogo, disabled }: Props) {
  const { t } = useT()
  const { logoDisabled, setLogoDisabled } = usePosterEditor()
  const [activeLogoGroup, setActiveLogoGroup] = useState("all")
  const [visibleLogoCount, setVisibleLogoCount] = useState(10)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  // Custom logo from a direct image link (PNG/SVG/WebP with transparency works best).
  const addCustomUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const url = urlInput.trim()
    if (!/^https?:\/\//i.test(url) || url.length > 2000) {
      setUrlError(t("ui.invalidUrl") || "Please enter a valid HTTP/HTTPS URL")
      return
    }
    setUrlError(null)
    setUrlLoading(true)
    const probe = new window.Image()
    probe.onload = () => {
      setUrlLoading(false)
      selectLogo({ file_path: url, iso_639_1: null, vote_average: 0, width: probe.naturalWidth, height: probe.naturalHeight })
      setUrlInput("")
      setShowUrlInput(false)
    }
    probe.onerror = () => {
      setUrlLoading(false)
      setUrlError("Couldn't load an image from that link")
    }
    probe.src = posterUrl(url, "w500")
  }

  const customLogoControl = (
    <div className="mb-3">
      {showUrlInput ? (
        <form onSubmit={addCustomUrl} className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              type="url"
              aria-label="Custom logo link"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://… direct link to a logo image"
              disabled={disabled || urlLoading}
              className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100"
            />
            <button type="submit" disabled={disabled || urlLoading || !urlInput.trim()} className="btn-secondary px-3 text-xs">
              {urlLoading ? "…" : t("ui.add") || "Add"}
            </button>
          </div>
          {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
        </form>
      ) : (
        <button type="button" disabled={disabled} onClick={() => setShowUrlInput(true)} className="btn-secondary w-full py-2 px-3 text-xs">
          <LinkIcon className="w-3.5 h-3.5" /> {t("ui.addCustomLink") || "Add custom link"}
        </button>
      )}
    </div>
  )

  const isCustomSelected = !!selectedLogo && /^https?:\/\//i.test(selectedLogo.file_path) && !logos.some((l) => l.file_path === selectedLogo.file_path)

  useEffect(() => {
    setVisibleLogoCount(10)
  }, [logos, activeLogoGroup, lang])

  if (logos.length === 0 && !isCustomSelected) return (
    <div>
      {customLogoControl}
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl border-2 border-dashed border-surface2 bg-surface/20 flex items-center justify-center">
            <Plus className="w-4 h-4 text-zinc-600" />
          </div>
        ))}
      </div>
    </div>
  )
  const groups = groupBy(logos, (img) => img.iso_639_1 || "xx")
  const langGroups = Object.entries(groups).sort(([a], [b]) => {
    if (a === lang) return -1; if (b === lang) return 1
    if (a === "en") return -1; if (b === "en") return 1
    return a.localeCompare(b)
  })

  const logoTabs = [
    { key: "all", label: t("ui.all"), count: logos.length },
    { key: lang, label: LANG_NAMES[lang] || lang, count: groups[lang]?.length ?? 0 },
    ...(lang !== "en" ? [{ key: "en", label: "English", count: groups["en"]?.length ?? 0 }] : []),
    { key: "xx", label: t("ui.withoutLanguage"), count: groups["xx"]?.length ?? 0 },
  ].filter((tab) => tab.count > 0 || tab.key === "all")

  const visibleLogoGroups = activeLogoGroup === "all"
    ? langGroups
    : langGroups.filter(([language]) => language === activeLogoGroup)

  const totalAvailableLogos = visibleLogoGroups.reduce((acc, [, imgs]) => acc + imgs.length, 0)

  let renderedLogosCount = 0

  return (
    <div>
      {customLogoControl}
      {isCustomSelected && selectedLogo && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="poster-tile poster-tile-active relative p-2 rounded-xl bg-accent-orange/10 flex items-center justify-center h-20" title="Custom logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL via proxy */}
            <img src={posterUrl(selectedLogo.file_path, "w154")} alt="" className="max-h-14 max-w-full object-contain" />
            <div className="absolute top-1 right-1 rounded-md bg-accent-orange text-white p-0.5"><Check className="w-3 h-3" /></div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/10 rounded-xl mb-3 shadow-inner overflow-x-auto scrollbar-none scroll-fade-mask w-full min-w-0">
        {logoTabs.map((tab) => (
          <button type="button"
            aria-label={tab.label}
            key={tab.key}
            onClick={() => setActiveLogoGroup(tab.key)}
            className={`tab-chip h-auto min-h-[30px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 shrink-0 whitespace-nowrap ${activeLogoGroup === tab.key ? "tab-chip-active bg-zinc-100 text-zinc-950 shadow-md shadow-white/10 border border-white/80" : "text-zinc-400 hover:text-zinc-100 border-transparent bg-transparent"}`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] font-semibold opacity-75 ${activeLogoGroup === tab.key ? "text-zinc-800" : "text-zinc-500"}`}>{tab.count}</span>
          </button>
        ))}
      </div>
      {visibleLogoGroups.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">{t("ui.noLogoInLanguage")}</p>
      ) : (
        visibleLogoGroups.map(([language, imgs]) => {
          const quotaLeft = visibleLogoCount - renderedLogosCount
          if (quotaLeft <= 0) return null
          const best = limitBest(imgs).slice(0, quotaLeft)
          if (best.length === 0) return null
          renderedLogosCount += best.length
          return (
            <div key={language} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-zinc-700/40" />
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider shrink-0">{LANG_NAMES[language] || language} {best.length < imgs.length ? `• ${best.length}` : ""}</h4>
                <div className="h-px flex-1 bg-zinc-700/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {best.map((img) => {
                  const isActive = selectedLogo?.file_path === img.file_path
                  return (
                    <button type="button" key={img.file_path} disabled={disabled} onClick={() => selectLogo(img)} className={`poster-tile group relative p-2 rounded-xl transition-all duration-200 ease-out flex items-center justify-center h-20 ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${isActive ? "poster-tile-active bg-accent-orange/10" : ""}`} title={isActive ? t("ui.logoSelected") : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- TMDB dynamic URL */}
                      <img src={posterUrl(img.file_path, "w154")} alt="" loading="lazy" decoding="async" className="max-h-14 max-w-full object-contain transition-transform duration-200 group-hover:scale-110" />
                      {isActive && <div className="absolute top-1 right-1 rounded-md bg-accent-orange text-white p-0.5 shadow-sm shadow-accent-orange/40"><Check className="w-3 h-3" /></div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {totalAvailableLogos > visibleLogoCount && (
        <button
          type="button"
          aria-label={t("ui.loadMoreLogosAria")}
          onClick={() => setVisibleLogoCount((prev) => prev + 10)}
          className="btn-secondary w-full mb-3 py-2 px-3 text-xs"
        >
          <ChevronDown className="w-4 h-4" />
          {t("ui.loadMoreLogos", { count: Math.min(10, totalAvailableLogos - visibleLogoCount) })}
          <span className="text-[10px] text-zinc-500 font-normal">{t("ui.xOfY", { current: visibleLogoCount, total: totalAvailableLogos })}</span>
        </button>
      )}

      {selectedLogo && (
        <div className="editor-pill mt-3">
          <Check className="w-3 h-3" />{t("ui.logoSelected")}
        </div>
      )}
      {!selectedLogo && (
        <button type="button" aria-label={logoDisabled ? t("ui.removeLogo") : t("ui.enableLogos")} disabled={disabled} onClick={() => setLogoDisabled(!logoDisabled)} className={`mt-3 w-full h-9 rounded-lg border text-[11px] font-semibold transition-all ${disabled ? "bg-surface2/30 text-zinc-600 cursor-not-allowed border-surface2" : logoDisabled ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-surface2 bg-white/[0.03] text-muted hover:text-zinc-200 hover:border-zinc-600"}`}>
          <span className="flex items-center justify-center gap-1.5">{logoDisabled ? t("ui.logosDisabled") : t("ui.disableLogos")}</span>
        </button>
      )}
      {selectedLogo && (
        <button type="button" aria-label={t("ui.removeLogo")} disabled={disabled} onClick={removeLogo} className={`mt-2 w-full h-9 rounded-lg border text-[11px] font-semibold transition-all ${disabled ? "bg-surface2/30 text-zinc-600 cursor-not-allowed border-surface2" : "border-surface2 bg-white/[0.03] text-muted hover:text-red-300 hover:border-red-500/30"}`}>
          <span className="flex items-center justify-center gap-1.5"><Trash2 className="w-3 h-3" />{t("ui.removeLogo")}</span>
        </button>
      )}
    </div>
  )
})
