"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { X, ChevronDown, Search, Sparkles, Check, Loader2 } from "lucide-react"
import { useVehicleSpecs } from "@/hooks/use-vehicle-specs"
import { cn } from "@/lib/utils"
import {
  FUEL_TYPES,
  TRANSMISSIONS,
  BODY_TYPES,
  DRIVETRAINS,
  EXTERIOR_COLORS,
  INTERIOR_COLORS,
} from "@/types/portfolio"
import type { PortfolioVehicleInsert } from "@/types/portfolio"

interface AddVehicleWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: PortfolioVehicleInsert) => Promise<void>
  initialData?: Partial<PortfolioVehicleInsert>
  mode?: "add" | "edit"
}

/* ------------------------------------------------------------------ */
/*  Searchable combobox (Make / Model) — pure DOM, no radix portals   */
/* ------------------------------------------------------------------ */
function SearchableCombobox({
  value,
  onSelect,
  options,
  placeholder,
  disabled,
  id,
}: {
  value: string
  onSelect: (value: string) => void
  options: string[]
  placeholder: string
  disabled?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  return (
    <div ref={ref} className="relative" id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setSearch("") }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-sm transition-all",
          "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
          open && "ring-2 ring-primary/20 border-primary",
          disabled && "cursor-not-allowed opacity-50 bg-muted",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1.5 w-full rounded-lg border bg-white shadow-xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onSelect(opt); setOpen(false); setSearch("") }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    "hover:bg-primary/5",
                    value === opt && "bg-primary/5 text-primary font-medium",
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value === opt ? "opacity-100 text-primary" : "opacity-0")} />
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Styled dropdown for small option lists (fuel, body, etc.)         */
/* ------------------------------------------------------------------ */
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly string[] | string[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-sm transition-all",
          "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
          open && "ring-2 ring-primary/20 border-primary",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1.5 w-full rounded-lg border bg-white shadow-xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                  "hover:bg-primary/5",
                  value === opt && "bg-primary/5 text-primary font-medium",
                )}
              >
                <Check className={cn("h-3.5 w-3.5 shrink-0", value === opt ? "opacity-100 text-primary" : "opacity-0")} />
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main form                                                          */
/* ------------------------------------------------------------------ */
const currentYear = new Date().getFullYear()

export function AddVehicleWizard({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "add",
}: AddVehicleWizardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [autoFilled, setAutoFilled] = useState(false)
  const { toast } = useToast()
  const { makes, models, loadingMakes, fetchModels, fetchSpecs } = useVehicleSpecs()
  const lastAutoFillRef = useRef("")

  const [form, setForm] = useState<Partial<PortfolioVehicleInsert>>({
    make: "",
    model: "",
    year: currentYear,
    trim: "",
    purchase_price: 0,
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_mileage: undefined,
    current_mileage: undefined,
    fuel_type: undefined,
    transmission: undefined,
    body_type: undefined,
    exterior_color: undefined,
    interior_color: undefined,
    num_doors: undefined,
    num_seats: undefined,
    engine_displacement_cc: undefined,
    power_kw: undefined,
    power_hp: undefined,
    drivetrain: undefined,
    modifications: undefined,
    notes: undefined,
    ...initialData,
  })

  const set = (field: keyof PortfolioVehicleInsert, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
  }

  const setNumber = (field: keyof PortfolioVehicleInsert, raw: string) => {
    set(field, raw === "" ? undefined : Number(raw))
  }

  const setPowerKw = (raw: string) => {
    const kw = raw === "" ? undefined : Number(raw)
    setForm((prev) => ({ ...prev, power_kw: kw, power_hp: kw ? Math.round(kw * 1.36) : undefined }))
  }

  const setPowerHp = (raw: string) => {
    const hp = raw === "" ? undefined : Number(raw)
    setForm((prev) => ({ ...prev, power_hp: hp, power_kw: hp ? Math.round(hp / 1.36) : undefined }))
  }

  const handleMakeChange = (make: string) => {
    set("make", make)
    set("model", "")
    fetchModels(make)
  }

  const tryAutoFill = async (make: string, model: string, year?: number) => {
    const key = `${make}|${model}|${year ?? ""}`
    if (key === lastAutoFillRef.current || !make || !model) return
    lastAutoFillRef.current = key
    const specs = await fetchSpecs(make, model, year)
    if (!specs) return
    setForm((prev) => {
      const u: Partial<PortfolioVehicleInsert> = { ...prev }
      if (!prev.fuel_type && specs.fuel_type) u.fuel_type = specs.fuel_type
      if (!prev.transmission && specs.transmission) u.transmission = specs.transmission
      if (!prev.drivetrain && specs.drive) u.drivetrain = specs.drive
      if (!prev.engine_displacement_cc && specs.engine_displacement) u.engine_displacement_cc = Math.round(specs.engine_displacement * 1000)
      return u
    })
    setAutoFilled(true)
    setTimeout(() => setAutoFilled(false), 3000)
  }

  const handleModelChange = (model: string) => {
    set("model", model)
    if (form.make && model) tryAutoFill(form.make, model, form.year)
  }

  useEffect(() => {
    if (form.make && form.model && form.year) tryAutoFill(form.make, form.model, form.year)
  }, [form.year])

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.make?.trim()) errs.make = "Required"
    if (!form.model?.trim()) errs.model = "Required"
    if (!form.year || form.year < 1900 || form.year > currentYear + 1) errs.year = "Invalid year"
    if (!form.purchase_price || form.purchase_price <= 0) errs.purchase_price = "Required"
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: "smooth", block: "center" })
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      await onSubmit(form as PortfolioVehicleInsert)
      toast({
        title: mode === "add" ? "Vehicle Added" : "Vehicle Updated",
        description: `${form.year} ${form.make} ${form.model} has been ${mode === "add" ? "added to" : "updated in"} your portfolio.`,
      })
      onOpenChange(false)
      setForm({ make: "", model: "", year: currentYear, trim: "", purchase_price: 0, purchase_date: new Date().toISOString().split("T")[0] })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Something went wrong.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="theme-b fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{mode === "add" ? "Add Vehicle to Portfolio" : "Edit Vehicle"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Fill in the details below. Specifications auto-fill when you select a make and model.</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 145px)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* LEFT SIDE */}
            <div className="p-8 space-y-8">
              {/* Vehicle Identity */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Vehicle Identity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Make <span className="text-destructive">*</span></Label>
                    <SearchableCombobox
                      id="make"
                      value={form.make || ""}
                      onSelect={handleMakeChange}
                      options={makes}
                      placeholder={loadingMakes ? "Loading..." : "Select make"}
                      disabled={loadingMakes}
                    />
                    {errors.make && <p className="text-xs text-destructive">{errors.make}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Model <span className="text-destructive">*</span></Label>
                    <SearchableCombobox
                      id="model"
                      value={form.model || ""}
                      onSelect={handleModelChange}
                      options={models}
                      placeholder={!form.make ? "Select make first" : "Select model"}
                      disabled={!form.make}
                    />
                    {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Year <span className="text-destructive">*</span></Label>
                    <Input id="year" type="number" value={form.year || ""} onChange={(e) => setNumber("year", e.target.value)} placeholder="2023" min={1900} max={currentYear + 1} className="h-10 rounded-lg" />
                    {errors.year && <p className="text-xs text-destructive">{errors.year}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Trim / Variant</Label>
                    <Input id="trim" value={form.trim || ""} onChange={(e) => set("trim", e.target.value)} placeholder="e.g. Competition" className="h-10 rounded-lg" />
                  </div>
                </div>
              </section>

              {/* Purchase Information */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Purchase Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Price (EUR) <span className="text-destructive">*</span></Label>
                    <Input id="purchase_price" type="number" value={form.purchase_price || ""} onChange={(e) => setNumber("purchase_price", e.target.value)} placeholder="65,000" min={0} className="h-10 rounded-lg" />
                    {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Purchase Date</Label>
                    <Input id="purchase_date" type="date" value={form.purchase_date || ""} onChange={(e) => set("purchase_date", e.target.value)} className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Mileage at Purchase (km)</Label>
                    <Input id="purchase_mileage" type="number" value={form.purchase_mileage ?? ""} onChange={(e) => setNumber("purchase_mileage", e.target.value)} placeholder="28,000" min={0} className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Current Mileage (km)</Label>
                    <Input id="current_mileage" type="number" value={form.current_mileage ?? ""} onChange={(e) => setNumber("current_mileage", e.target.value)} placeholder="32,000" min={0} className="h-10 rounded-lg" />
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  Notes
                  <span className="text-xs font-normal text-muted-foreground">— Optional</span>
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Modifications</Label>
                    <Textarea id="modifications" value={form.modifications || ""} onChange={(e) => set("modifications", e.target.value)} placeholder="e.g. Akrapovic exhaust, KW coilovers..." rows={2} className="rounded-lg resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Additional Notes</Label>
                    <Textarea id="notes" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes..." rows={2} className="rounded-lg resize-none" />
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT SIDE — Specifications */}
            <div className="p-8 bg-muted/30 border-l space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Specifications
                  <span className="text-xs font-normal text-muted-foreground">— Optional</span>
                </h3>
                {autoFilled && (
                  <span className="text-xs text-primary flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full font-medium animate-in fade-in duration-300">
                    <Sparkles className="h-3 w-3" /> Auto-filled
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Fuel Type</Label>
                  <StyledSelect value={form.fuel_type || ""} onChange={(v) => set("fuel_type", v || undefined)} options={FUEL_TYPES} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Transmission</Label>
                  <StyledSelect value={form.transmission || ""} onChange={(v) => set("transmission", v || undefined)} options={TRANSMISSIONS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Body Type</Label>
                  <StyledSelect value={form.body_type || ""} onChange={(v) => set("body_type", v || undefined)} options={BODY_TYPES} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Drivetrain</Label>
                  <StyledSelect value={form.drivetrain || ""} onChange={(v) => set("drivetrain", v || undefined)} options={DRIVETRAINS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Exterior Color</Label>
                  <StyledSelect value={form.exterior_color || ""} onChange={(v) => set("exterior_color", v || undefined)} options={EXTERIOR_COLORS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Interior Color</Label>
                  <StyledSelect value={form.interior_color || ""} onChange={(v) => set("interior_color", v || undefined)} options={INTERIOR_COLORS} placeholder="Select..." />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Engine & Performance</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Power (kW)</Label>
                    <Input id="power_kw" type="number" value={form.power_kw ?? ""} onChange={(e) => setPowerKw(e.target.value)} placeholder="331" min={0} className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Power (HP)</Label>
                    <Input id="power_hp" type="number" value={form.power_hp ?? ""} onChange={(e) => setPowerHp(e.target.value)} placeholder="450" min={0} className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Engine (cc)</Label>
                    <Input id="engine_cc" type="number" value={form.engine_displacement_cc ?? ""} onChange={(e) => setNumber("engine_displacement_cc", e.target.value)} placeholder="2998" min={0} className="h-10 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Doors</Label>
                  <StyledSelect value={form.num_doors?.toString() || ""} onChange={(v) => set("num_doors", v ? Number(v) : undefined)} options={["2","3","4","5"]} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Seats</Label>
                  <StyledSelect value={form.num_seats?.toString() || ""} onChange={(v) => set("num_seats", v ? Number(v) : undefined)} options={["2","4","5","7","8","9"]} placeholder="Select..." />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t bg-white">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-lg">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-lg px-6">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              mode === "add" ? "Add Vehicle" : "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
