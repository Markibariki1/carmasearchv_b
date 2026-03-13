"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
          "flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 transition-all",
          "hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500",
          open && "ring-2 ring-blue-100 border-blue-500",
          disabled && "cursor-not-allowed opacity-50 bg-gray-100",
          !value && "!text-gray-400",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1.5 w-full rounded-lg border border-gray-200 bg-white shadow-xl shadow-black/8 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No results found.</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onSelect(opt); setOpen(false); setSearch("") }}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors text-left",
                    "hover:bg-blue-50 hover:text-gray-900",
                    value === opt && "bg-blue-50 !text-blue-600 font-medium",
                  )}
                >
                  {value === opt && <Check className="h-3.5 w-3.5 shrink-0 mr-2 text-blue-600" />}
                  <span className="truncate">{opt}</span>
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
          "flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 transition-all",
          "hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500",
          open && "ring-2 ring-blue-100 border-blue-500",
          !value && "!text-gray-400",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1.5 w-full rounded-lg border border-gray-200 bg-white shadow-xl shadow-black/8 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors text-left",
                  "hover:bg-blue-50 hover:text-gray-900",
                  value === opt && "bg-blue-50 !text-blue-600 font-medium",
                )}
              >
                {value === opt && <Check className="h-3.5 w-3.5 shrink-0 mr-2 text-blue-600" />}
                <span className="truncate">{opt}</span>
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
    year: undefined,
    trim: "",
    purchase_price: undefined,
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
      setForm({ make: "", model: "", year: undefined, trim: "", purchase_price: undefined, purchase_date: new Date().toISOString().split("T")[0] })
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
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">{mode === "add" ? "Add Vehicle to Portfolio" : "Edit Vehicle"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fill in the details below. Specifications auto-fill when you select a make and model.</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 145px)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* LEFT SIDE */}
            <div className="p-8 space-y-8">
              {/* Vehicle Identity */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-blue-600" />
                  Vehicle Identity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Make <span className="text-red-500">*</span></Label>
                    <SearchableCombobox
                      id="make"
                      value={form.make || ""}
                      onSelect={handleMakeChange}
                      options={makes}
                      placeholder={loadingMakes ? "Loading..." : "Select make"}
                      disabled={loadingMakes}
                    />
                    {errors.make && <p className="text-xs text-red-500">{errors.make}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Model <span className="text-red-500">*</span></Label>
                    <SearchableCombobox
                      id="model"
                      value={form.model || ""}
                      onSelect={handleModelChange}
                      options={models}
                      placeholder={!form.make ? "Select make first" : "Select model"}
                      disabled={!form.make}
                    />
                    {errors.model && <p className="text-xs text-red-500">{errors.model}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Year <span className="text-red-500">*</span></Label>
                    <Input id="year" type="text" inputMode="numeric" value={form.year ?? ""} onChange={(e) => setNumber("year", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 2023" className="h-10 rounded-lg text-gray-900" />
                    {errors.year && <p className="text-xs text-red-500">{errors.year}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Trim / Variant</Label>
                    <Input id="trim" value={form.trim || ""} onChange={(e) => set("trim", e.target.value)} placeholder="e.g. Competition" className="h-10 rounded-lg text-gray-900" />
                  </div>
                </div>
              </section>

              {/* Purchase Information */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-blue-600" />
                  Purchase Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Price (EUR) <span className="text-red-500">*</span></Label>
                    <Input id="purchase_price" type="text" inputMode="numeric" value={form.purchase_price ?? ""} onChange={(e) => setNumber("purchase_price", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 65000" className="h-10 rounded-lg text-gray-900" />
                    {errors.purchase_price && <p className="text-xs text-red-500">{errors.purchase_price}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Purchase Date</Label>
                    <Input id="purchase_date" type="date" value={form.purchase_date || ""} onChange={(e) => set("purchase_date", e.target.value)} className="h-10 rounded-lg text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Mileage at Purchase (km)</Label>
                    <Input id="purchase_mileage" type="text" inputMode="numeric" value={form.purchase_mileage ?? ""} onChange={(e) => setNumber("purchase_mileage", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 28000" className="h-10 rounded-lg text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Current Mileage (km)</Label>
                    <Input id="current_mileage" type="text" inputMode="numeric" value={form.current_mileage ?? ""} onChange={(e) => setNumber("current_mileage", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 32000" className="h-10 rounded-lg text-gray-900" />
                  </div>
                </div>
              </section>

            </div>

            {/* RIGHT SIDE — Specifications */}
            <div className="p-8 bg-gray-50/60 border-l space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-blue-600" />
                  Specifications
                  <span className="text-xs font-normal text-gray-400">— Optional</span>
                </h3>
                {autoFilled && (
                  <span className="text-xs text-blue-600 flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full font-medium animate-in fade-in duration-300">
                    <Sparkles className="h-3 w-3" /> Auto-filled
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Fuel Type</Label>
                  <StyledSelect value={form.fuel_type || ""} onChange={(v) => set("fuel_type", v || undefined)} options={FUEL_TYPES} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Transmission</Label>
                  <StyledSelect value={form.transmission || ""} onChange={(v) => set("transmission", v || undefined)} options={TRANSMISSIONS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Body Type</Label>
                  <StyledSelect value={form.body_type || ""} onChange={(v) => set("body_type", v || undefined)} options={BODY_TYPES} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Drivetrain</Label>
                  <StyledSelect value={form.drivetrain || ""} onChange={(v) => set("drivetrain", v || undefined)} options={DRIVETRAINS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Exterior Color</Label>
                  <StyledSelect value={form.exterior_color || ""} onChange={(v) => set("exterior_color", v || undefined)} options={EXTERIOR_COLORS} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Interior Color</Label>
                  <StyledSelect value={form.interior_color || ""} onChange={(v) => set("interior_color", v || undefined)} options={INTERIOR_COLORS} placeholder="Select..." />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Engine & Performance</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Power (kW)</Label>
                    <Input id="power_kw" type="text" inputMode="numeric" value={form.power_kw ?? ""} onChange={(e) => setPowerKw(e.target.value.replace(/\D/g, ""))} placeholder="kW" className="h-10 rounded-lg text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Power (HP)</Label>
                    <Input id="power_hp" type="text" inputMode="numeric" value={form.power_hp ?? ""} onChange={(e) => setPowerHp(e.target.value.replace(/\D/g, ""))} placeholder="HP" className="h-10 rounded-lg text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Engine (cc)</Label>
                    <Input id="engine_cc" type="text" inputMode="numeric" value={form.engine_displacement_cc ?? ""} onChange={(e) => setNumber("engine_displacement_cc", e.target.value.replace(/\D/g, ""))} placeholder="cc" className="h-10 rounded-lg text-gray-900" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Doors</Label>
                  <StyledSelect value={form.num_doors?.toString() || ""} onChange={(v) => set("num_doors", v ? Number(v) : undefined)} options={["2","3","4","5"]} placeholder="Select..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Seats</Label>
                  <StyledSelect value={form.num_seats?.toString() || ""} onChange={(v) => set("num_seats", v ? Number(v) : undefined)} options={["2","4","5","7","8","9"]} placeholder="Select..." />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-gray-200 bg-white">
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
