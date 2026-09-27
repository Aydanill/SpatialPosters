"use client"

import { useState, useRef, useEffect } from "react"
import { PICKER_LANGS } from "@/lib/utils"
import { REGIONS } from "@/lib/regions"
import { useT } from "@/lib/contexts/TranslationContext"
import { AnimatedSpatialWord } from "@/components/AnimatedSpatialWord"
import { ChevronLeft, Lock, ArrowRight, ShieldCheck, Sparkles, Languages, MapPin, Check, Globe } from "lucide-react"

interface SetupWizardProps {
  /** Applica la lingua (codice 2 lettere) senza chiudere il wizard. */
  onPickLang: (code: string) => void
  /** Applica la nazionalità delle liste (codice regione, es. "IT"). */
  onPickRegion: (regionCode: string) => void
  /** Chiude il wizard. */
  onDone: () => void
}

export function LangPicker({ onPickLang, onPickRegion, onDone }: SetupWizardProps) {
  const { t } = useT()
  const [step, setStep] = useState<"lang" | "region" | "pin">("lang")
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === "pin") {
      pinInputRef.current?.focus()
    }
  }, [step])

  const pickLang = (code: string) => {
    setSelectedLang(code)
    onPickLang(code)
    setTimeout(() => {
      setStep("region")
    }, 400)
  }

  const pickRegion = (regionCode: string) => {
    setSelectedRegion(regionCode)
    onPickRegion(regionCode)
    setTimeout(() => {
      setStep("pin")
    }, 400)
  }

  const handleSavePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (pin.length < 4) {
      setPinError(t("ui.setupPinMinDigits"))
      return
    }
    setPinLoading(true)
    setPinError(null)

    try {
      const res = await fetch("/api/auth/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: pin }),
      })

      if (res.ok) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("spatialposters:pin-change", { detail: { unlocked: true } }))
        }
        onDone()
      } else {
        const err = await res.json().catch(() => ({}))
        setPinError(err.error || t("ui.pinSaveError"))
      }
    } catch {
      setPinError(t("ui.pinConnError"))
    } finally {
      setPinLoading(false)
    }
  }

  const handleSkipPin = () => {
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-500 overflow-y-auto">
      {/* Dynamic Ambient Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-accent-orange/20 rounded-full mix-blend-screen filter blur-[150px] opacity-70 animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[150px] opacity-60 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[700px] h-[700px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[150px] opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-3xl my-auto flex flex-col items-center">
        {/* Main Glass Panel */}
        <div className="w-full bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden relative transition-all duration-500">
          
          {/* Subtle Top Glow Line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-accent-orange to-transparent opacity-70" />

          <div className="p-8 sm:p-12 relative z-10 flex flex-col items-center">
            
            {/* Header Branding */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 text-accent-orange animate-pulse" />
              <span className="text-xs font-semibold tracking-widest text-zinc-300 uppercase flex items-center gap-1.5">
                Welcome to <AnimatedSpatialWord />
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500 tracking-tight text-center mb-3">
              {step === "pin" ? t("ui.setupPinTitle") : step === "region" ? t("ui.setupRegionTitle") : "Choose Your Language"}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 text-center max-w-lg mb-10">
              {step === "pin" ? t("ui.setupPinSubtitle") : step === "region" ? t("ui.setupRegionSubtitle") : "Select the interface language for your SpatialPosters experience."}
            </p>

            {/* Premium Stepper */}
            <div className="flex items-center justify-center gap-3 w-full max-w-lg mb-12">
              <StepIndicator currentStep={step} stepId="lang" icon={Languages} label="Language" isActive={step === "lang"} isCompleted={step === "region" || step === "pin"} />
              <div className={`h-[2px] flex-1 rounded-full transition-colors duration-500 ${step === "region" || step === "pin" ? "bg-accent-orange" : "bg-white/10"}`} />
              <StepIndicator currentStep={step} stepId="region" icon={MapPin} label="Region" isActive={step === "region"} isCompleted={step === "pin"} />
              <div className={`h-[2px] flex-1 rounded-full transition-colors duration-500 ${step === "pin" ? "bg-accent-orange" : "bg-white/10"}`} />
              <StepIndicator currentStep={step} stepId="pin" icon={Lock} label="Security" isActive={step === "pin"} isCompleted={false} />
            </div>

            {/* STEP 1: LANGUAGE SELECTION GRID */}
            {step === "lang" && (
              <div key="lang" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
                {PICKER_LANGS.map((l) => (
                  <SelectionCard 
                    key={l.key} 
                    title={l.name} 
                    subtitle={l.sub} 
                    emoji={l.flag} 
                    isSelected={selectedLang === l.code} 
                    onClick={() => pickLang(l.code)} 
                  />
                ))}
              </div>
            )}

            {/* STEP 2: REGION SELECTION GRID */}
            {step === "region" && (
              <div key="region" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
                {REGIONS.map((r) => (
                  <SelectionCard 
                    key={r.code} 
                    title={r.label} 
                    subtitle={r.code} 
                    emoji={r.flag} 
                    isSelected={selectedRegion === r.code} 
                    onClick={() => pickRegion(r.code)} 
                  />
                ))}
              </div>
            )}

            {/* STEP 3: OPTIONAL PIN STEP */}
            {step === "pin" && (
              <div key="pin" className="w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500 flex flex-col items-center">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-accent-orange/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-8 shadow-[0_0_40px_rgba(245,158,11,0.2)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Lock className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
                </div>

                <form onSubmit={handleSavePin} className="w-full space-y-6">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-accent-orange/0 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                    <input
                      ref={pinInputRef}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value.replace(/\D/g, ""))
                        setPinError(null)
                      }}
                      placeholder="••••"
                      className="relative w-full text-center text-4xl font-mono tracking-[0.5em] py-5 px-6 rounded-2xl bg-black/80 border border-white/10 text-white placeholder-zinc-800 focus:outline-none focus:border-amber-500/50 transition-all shadow-inner"
                    />
                    {pinError && (
                      <p className="text-sm text-rose-400 text-center mt-3 font-semibold animate-shake">
                        {pinError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-zinc-400 justify-center bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="leading-relaxed">{t("ui.setupPinStremioNotice")}</span>
                  </div>

                  <div className="pt-4 space-y-3">
                    <button
                      type="submit"
                      disabled={pin.length < 4 || pinLoading}
                      className="group relative w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-accent-orange to-rose-500 text-black font-extrabold text-sm tracking-widest uppercase hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[0_10px_30px_rgba(249,115,22,0.3)] flex items-center justify-center gap-3 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                      <span className="relative z-10">{pinLoading ? t("ui.setupPinSaving") : t("ui.setupPinSave")}</span>
                      <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipPin}
                      className="w-full py-3 text-center text-sm font-semibold text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                    >
                      {t("ui.setupPinSkip")}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Global Back Button */}
            {step !== "lang" && (
              <button
                type="button"
                onClick={() => setStep(step === "pin" ? "region" : "lang")}
                className="absolute top-8 left-8 p-3 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 group"
                aria-label={t("ui.back")}
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// Subcomponents for Premium UI

function StepIndicator({ 
  currentStep, stepId, icon: Icon, label, isActive, isCompleted 
}: { 
  currentStep: string, stepId: string, icon: any, label: string, isActive: boolean, isCompleted: boolean 
}) {
  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? "scale-110" : "opacity-70 grayscale"}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
        isCompleted 
          ? "bg-accent-orange border-accent-orange text-black shadow-[0_0_20px_rgba(249,115,22,0.4)]" 
          : isActive
          ? "bg-accent-orange/20 border-accent-orange text-accent-orange shadow-[0_0_15px_rgba(249,115,22,0.2)]"
          : "bg-zinc-900 border-zinc-700 text-zinc-500"
      }`}>
        {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={`text-[10px] uppercase tracking-wider font-bold ${isActive || isCompleted ? "text-zinc-200" : "text-zinc-600"}`}>
        {label}
      </span>
    </div>
  )
}

function SelectionCard({ 
  title, subtitle, emoji, isSelected, onClick 
}: { 
  title: string, subtitle: string, emoji: React.ReactNode, isSelected: boolean, onClick: () => void 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer overflow-hidden outline-none ${
        isSelected
          ? "bg-accent-orange/15 border-accent-orange shadow-[0_0_30px_rgba(249,115,22,0.15)] scale-[0.98]"
          : "bg-white/[0.02] hover:bg-white/[0.06] border-white/5 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <span className={`text-4xl shrink-0 transition-transform duration-500 ${isSelected ? "scale-110" : "group-hover:scale-110 group-hover:rotate-3"}`}>
        {emoji || <Globe className="w-8 h-8 text-zinc-500" />}
      </span>
      
      <div className="flex-1 min-w-0 z-10">
        <p className={`text-base font-bold transition-colors truncate ${isSelected ? "text-accent-orange" : "text-zinc-200 group-hover:text-white"}`}>
          {title}
        </p>
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mt-1">
          {subtitle}
        </p>
      </div>

      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all z-10 ${
        isSelected 
          ? "bg-accent-orange border-accent-orange text-black" 
          : "border-zinc-700 text-transparent group-hover:border-zinc-500"
      }`}>
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      </div>
    </button>
  )
}
