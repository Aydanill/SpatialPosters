"use client"

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { usePSelector } from "@/lib/context"
import { useT } from "@/lib/contexts/TranslationContext"
import { useSearchCtx } from "@/lib/contexts/SearchContext"
import { titleOf, yearOf } from "@/lib/utils"
import { SearchBar } from "@/components/SearchBar"
import { PosterCardSkeleton } from "@/components/Skeleton"
import { AnimatedSpatialWord } from "@/components/AnimatedSpatialWord"
import { ChevronRight, Star, Loader2, ChevronDown, ArrowLeft, Clapperboard, Tv } from "lucide-react"
import { PosterDepthEdge } from "@/components/PosterDepthGlow"

interface Props {
  mobileToolbar?: ReactNode
}

export function SearchView({ mobileToolbar }: Props) {
  const { t } = useT()
  const s = useSearchCtx()
  const { setQuery } = s
  const tmdbKey = usePSelector((v) => v.tmdbKey)
  const mappingsMap = usePSelector((v) => v.mappingsMap)
  const navigateToPoster = usePSelector((v) => v.navigateToPoster)
  const router = usePSelector((v) => v.router)
  const goHome = usePSelector((v) => v.goHome)
  const [searchFocused, setSearchFocused] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleQueryChange = useCallback((q: string) => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    queryDebounceRef.current = setTimeout(() => setQuery(q), 250)
  }, [setQuery])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    }
  }, [])

  // Random saved posters — shuffled once, max 15
  const randomSavedPosters = useMemo(() => {
    const all = Array.from(mappingsMap.values()).filter(m => m.tmdbId && m.posterPath)
    if (all.length === 0) return []
    const shuffled = [...all].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 15)
  }, [mappingsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link ?q=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get("q")?.trim() ?? ""
    if (q.length >= 2) {
      s.setQuery(q)
      s.doSearch(q)
      setShowResults(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // isIdle: show homepage hero; once user submits search → showResults flips to true → stays active view
  const isIdle = !showResults && !s.searching

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try { await s.loadMore() }
    finally { setLoadingMore(false) }
  }

  // ─── IDLE: Full-page hero homepage ────────────────────────────────────────
  if (isIdle) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* ── Hero Zone ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-24 md:pt-32 pb-10 md:pb-16 relative">

          {/* Decorative orb behind logo */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-3xl pointer-events-none select-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(var(--accent-rgb,249,115,22),0.07) 0%, transparent 70%)" }}
          />

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            onClick={goHome}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome() } }}
            role="button"
            tabIndex={0}
            aria-label={t("ui.home")}
            src="/SpatialPosters.png"
            alt="SpatialPosters"
            decoding="async"
            className="h-14 sm:h-20 md:h-28 w-auto cursor-pointer hover:brightness-110 active:scale-95 transition-all duration-300 mb-4 md:mb-6 relative z-10 drop-shadow-2xl"
          />

          {/* Animated tagline */}
          <p className="relative z-10 text-center text-xs sm:text-sm md:text-base mb-8 sm:mb-10 md:mb-12 max-w-xl text-zinc-400 flex items-center justify-center gap-2 flex-wrap font-medium tracking-wide">
            <span className="uppercase tracking-widest text-[10px] sm:text-xs text-zinc-500">Enhance your Poster Experience with</span>
            <AnimatedSpatialWord />
          </p>

          {/* ── Search Bar ─────────────────────────────────────────── */}
          <div className="relative z-[100] isolate w-full max-w-2xl mx-auto">
            <SearchBar
              tmdbKey={tmdbKey}
              value={s.query}
              onChange={handleQueryChange}
              onSearch={(q) => { s.setQuery(q); s.doSearch(q); setShowResults(true) }}
              large
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setSearchFocused(false), 200) }}
              error={s.error}
              recentSearches={s.recentSearches}
              onClearRecentSearches={s.clearRecentSearches}
              onRemoveRecentSearch={s.removeRecentSearch}
            />
          </div>

          {/* Mobile Toolbar */}
          {mobileToolbar && (
            <div className="mt-6 flex md:hidden">{mobileToolbar}</div>
          )}
        </div>

        {/* ── Yours SpatialPosters Card (only if user has saved posters) ── */}
        {randomSavedPosters.length > 0 && (
          <div className="px-4 sm:px-6 md:px-10 pb-10 max-w-6xl mx-auto w-full animate-fade-scale-in">
            <button
              type="button"
              onClick={() => router.replace("myposters")}
              className="
                group w-full text-left relative overflow-hidden
                rounded-2xl md:rounded-3xl
                border border-white/[0.06] hover:border-white/[0.12]
                bg-white/[0.02] hover:bg-white/[0.04]
                transition-all duration-500 ease-out
                shadow-[0_0_60px_rgba(0,0,0,0.4)] hover:shadow-[0_0_80px_rgba(0,0,0,0.5)]
              "
            >
              {/* Subtle gradient overlay inside card */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-accent-orange/[0.04] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

              {/* Header row */}
              <div className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-6">
                <div>
                  <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight">
                    Yours SpatialPosters
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 font-medium">
                    {mappingsMap.size} saved · tap to manage
                  </p>
                </div>
                <div className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  bg-white/[0.05] border border-white/[0.08]
                  text-zinc-400 group-hover:text-white group-hover:bg-white/[0.10]
                  text-xs font-medium tracking-wide
                  transition-all duration-300
                ">
                  <span>View all</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>
              </div>

              {/* Poster collage — staggered rows */}
              <div className="relative z-10 px-5 sm:px-8 pb-5 sm:pb-7">
                <div className="flex gap-2.5 sm:gap-3 md:gap-4 overflow-hidden">
                  {randomSavedPosters.map((mapping, idx) => {
                    const imgUrl = mapping.imgbbUrl || `https://image.tmdb.org/t/p/w342${mapping.posterPath}`
                    const isOdd = idx % 2 !== 0
                    return (
                      <div
                        key={`${mapping.tmdbId}-${mapping.posterPath}`}
                        className={`
                          relative shrink-0 rounded-xl overflow-hidden shadow-2xl
                          transition-all duration-500
                          w-[72px] sm:w-[90px] md:w-[110px]
                          aspect-[2/3]
                          ${isOdd ? "translate-y-3 md:translate-y-5" : ""}
                          group-hover:shadow-black/60
                        `}
                        style={{ transitionDelay: `${idx * 30}ms` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={mapping.title || "Poster"}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Subtle shine overlay */}
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.08] rounded-xl pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* No TMDB key nudge */}
        {!tmdbKey && (
          <div className="flex-1 flex flex-col items-center justify-center pb-20 px-4 animate-fade-scale-in">
            <div className="empty-state-illustration mb-4">
              <svg className="w-10 h-10 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" opacity="0.3"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" opacity="0.5"/>
              </svg>
            </div>
            <p className="text-muted text-sm font-medium mb-1.5">{t("ui.noKey")}</p>
            <p className="text-zinc-600 text-xs max-w-xs mx-auto leading-relaxed text-center">{t("ui.noKeySub")}</p>
          </div>
        )}
      </div>
    )
  }

  // ─── ACTIVE: Search Results ────────────────────────────────────────────────
  return (
    <div className="px-3 sm:px-4 pt-16 md:pt-[80px]">

      {/* Compact sticky search bar */}
      <div className="max-w-2xl mx-auto relative z-[100] isolate mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { s.setQuery(""); s.setError(null); setShowResults(false) }}
            className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.10] active:scale-90 transition-all duration-150 shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 relative">
            <SearchBar
              tmdbKey={tmdbKey}
              value={s.query}
              onChange={handleQueryChange}
              onSearch={(q) => { s.setQuery(q); s.doSearch(q) }}
              large
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setSearchFocused(false), 200) }}
              error={s.error}
              recentSearches={s.recentSearches}
              onClearRecentSearches={s.clearRecentSearches}
              onRemoveRecentSearch={s.removeRecentSearch}
            />
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {s.searching && s.results.length === 0 && (
        <div className="mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 max-w-7xl">
          {Array.from({ length: 12 }).map((_, i) => (
            <PosterCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Results grid */}
      {s.results.length > 0 && (
        <div className="relative animate-fade-scale-in">
          {s.searching && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-2xl flex items-center justify-center">
              <p className="text-sm text-muted animate-pulse">{t("ui.searching")}</p>
            </div>
          )}
          <div className="mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 max-w-7xl">
            {s.results.map((r, idx) => {
              const mapping = mappingsMap.get(`${r.media_type}:${r.id}`)
              const year = yearOf(r)
              const title = titleOf(r)
              return (
                <button
                  type="button"
                  key={`${r.media_type}:${r.id}`}
                  onClick={() => navigateToPoster(r)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl surface-card hover:scale-[1.03] hover:shadow-2xl hover:shadow-accent/10 active:scale-[0.97] transition-all duration-200 text-left poster-tile cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent animate-fade-scale-in press-scale"
                  style={{ animationDelay: `${Math.min(idx, 11) * 40}ms` }}
                  aria-label={`${title}${year ? ` (${year})` : ""}`}
                >
                  {/* Media type badge */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                    {r.media_type === "movie"
                      ? <Clapperboard className="w-2.5 h-2.5 text-accent-orange" />
                      : <Tv className="w-2.5 h-2.5 text-blue-400" />}
                  </div>

                  {/* Saved badge */}
                  {mapping && (
                    <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-accent-orange/20 border border-accent-orange/40 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                    </div>
                  )}

                  {/* Poster image */}
                  <div className="relative aspect-[2/3] bg-surface2 overflow-hidden">
                    {r.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://image.tmdb.org/t/p/w342${r.poster_path}`}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        {r.media_type === "movie" ? <Clapperboard className="w-8 h-8 opacity-30" /> : <Tv className="w-8 h-8 opacity-30" />}
                      </div>
                    )}
                    <PosterDepthEdge />

                    {/* Hover overlay */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-end p-3"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)" }}
                    >
                      <p className="text-xs font-bold text-white truncate drop-shadow-md">{title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {year && <span className="text-xs text-zinc-300 font-medium">{year}</span>}
                        {r.vote_average != null && r.vote_average > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-300" />
                            {r.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info strip */}
                  <div className="p-2.5 text-left bg-surface/50 border-t border-white/[0.04]">
                    <p className="text-xs font-semibold text-zinc-100 truncate group-hover:text-accent-orange transition-colors duration-200">{title}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted mt-0.5">
                      <span>{year || "—"}</span>
                      <span className="capitalize text-zinc-400">{r.media_type === "movie" ? t("ui.movie") : t("ui.tvSeries")}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Load more */}
          {s.searchPage < s.totalPages && (
            <div className="flex flex-col items-center justify-center mt-10 mb-4 gap-2">
              <button
                type="button"
                aria-label={t("ui.showMore")}
                disabled={loadingMore || s.searching}
                onClick={handleLoadMore}
                className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-medium text-zinc-200 bg-surface/90 hover:bg-surface2/90 border border-white/[0.08] hover:border-accent-orange/40 shadow-lg shadow-black/25 hover:shadow-accent-orange/10 backdrop-blur-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-accent-orange/0 via-accent-orange/10 to-accent-orange/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 text-accent-orange animate-spin" />
                    <span>{t("ui.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("ui.showMore")}</span>
                    <ChevronDown className="w-4 h-4 text-accent-orange/80 group-hover:text-accent-orange group-hover:translate-y-0.5 transition-all duration-200" />
                  </>
                )}
              </button>
              {s.totalPages > 1 && (
                <span className="text-[11px] text-zinc-500 font-mono tracking-wider">{s.searchPage} / {s.totalPages}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {s.error && (
        <div className="text-center py-12 animate-fade-scale-in">
          <div className="empty-state-illustration mb-4 border-red-900/40 bg-red-900/15">
            <svg className="w-10 h-10 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" opacity="0.4"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="text-danger text-sm font-medium mb-1">{t("ui.searchError")}</p>
          <p className="text-zinc-500 text-xs mb-4 max-w-xs mx-auto leading-relaxed">{s.error}</p>
          <button
            type="button"
            onClick={() => { s.setError(null); s.doSearch(s.query) }}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-900/30 border border-red-800/40 text-red-300 hover:bg-red-900/50 hover:text-red-200 active:scale-95 transition-all duration-200 press-scale"
          >
            {t("ui.retry")}
          </button>
        </div>
      )}

      {/* No results */}
      {s.results.length === 0 && !s.searching && !s.error && s.query.length >= 2 && tmdbKey && (
        <div className="text-center py-16 animate-fade-scale-in">
          <div className="empty-state-illustration mb-4">
            <svg className="w-10 h-10 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" opacity="0.4"/>
              <path d="m21 21-4.3-4.3" opacity="0.4"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
            </svg>
          </div>
          <p className="text-muted text-sm mb-2">{t("ui.noResults")}</p>
          <p className="text-zinc-500 text-xs max-w-xs mx-auto leading-relaxed">{t("ui.noResultsForQuery")}</p>
        </div>
      )}
    </div>
  )
}