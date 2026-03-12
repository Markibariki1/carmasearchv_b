"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { Car, Receipt, Settings2, FileText, Sparkles, ChevronsUpDown, Check } from "lucide-react"
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

function SectionHeader({ icon: Icon, title, optional }: { icon: React.ElementType; title: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      {optional && <span className="text-xs text-muted-foreground/60 font-normal ml-1">— Optional</span>}
    </div>
  )
}

/** Searchable combobox for Make / Model selection */
function SearchableSelect({
  value,
  onSelect,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  id,
}: {
  value: string
  onSelect: (value: string) => void
  options: string[]
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-9 px-3"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onSelect(opt)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

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
  const { makes, models, fetchModels, fetchSpecs } = useVehicleSpecs()
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
    vin: undefined,
    license_plate: undefined,
    condition: undefined,
    modifications: undefined,
    notes: undefined,
    ...initialData,
  })

  const set = (field: keyof PortfolioVehicleInsert, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const setNumber = (field: keyof PortfolioVehicleInsert, raw: string) => {
    const val = raw === "" ? undefined : Number(raw)
    set(field, val)
  }

  // Auto-convert kW <-> HP
  const setPowerKw = (raw: string) => {
    const kw = raw === "" ? undefined : Number(raw)
    setForm((prev) => ({
      ...prev,
      power_kw: kw,
      power_hp: kw ? Math.round(kw * 1.36) : undefined,
    }))
  }

  const setPowerHp = (raw: string) => {
    const hp = raw === "" ? undefined : Number(raw)
    setForm((prev) => ({
      ...prev,
      power_hp: hp,
      power_kw: hp ? Math.round(hp / 1.36) : undefined,
    }))
  }

  // When make changes, fetch models
  const handleMakeChange = (make: string) => {
    set("make", make)
    set("model", "")
    fetchModels(make)
  }

  // When model or year changes, try to autofill specs
  const tryAutoFill = async (make: string, model: string, year?: number) => {
    const key = `${make}|${model}|${year ?? ""}`
    if (key === lastAutoFillRef.current) return
    if (!make || !model) return
    lastAutoFillRef.current = key

    const specs = await fetchSpecs(make, model, year)
    if (!specs) return

    setForm((prev) => {
      const updates: Partial<PortfolioVehicleInsert> = { ...prev }
      if (!prev.fuel_type && specs.fuel_type) updates.fuel_type = specs.fuel_type
      if (!prev.transmission && specs.transmission) updates.transmission = specs.transmission
      if (!prev.drivetrain && specs.drive) updates.drivetrain = specs.drive
      if (!prev.engine_displacement_cc && specs.engine_displacement) {
        updates.engine_displacement_cc = Math.round(specs.engine_displacement * 1000)
      }
      return updates
    })
    setAutoFilled(true)
    setTimeout(() => setAutoFilled(false), 3000)
  }

  const handleModelChange = (model: string) => {
    set("model", model)
    if (form.make && model) tryAutoFill(form.make, model, form.year)
  }

  // Re-trigger autofill when year changes (if make+model already set)
  useEffect(() => {
    if (form.make && form.model && form.year) {
      tryAutoFill(form.make, form.model, form.year)
    }
  }, [form.year])

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.make?.trim()) errs.make = "Make is required"
    if (!form.model?.trim()) errs.model = "Model is required"
    if (!form.year || form.year < 1900 || form.year > currentYear + 1) errs.year = "Enter a valid year"
    if (!form.purchase_price || form.purchase_price <= 0) errs.purchase_price = "Enter a valid price"
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstErrorField = Object.keys(errs)[0]
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: "smooth", block: "center" })
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
      setForm({
        make: "",
        model: "",
        year: currentYear,
        trim: "",
        purchase_price: 0,
        purchase_date: new Date().toISOString().split("T")[0],
      })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="theme-b max-w-[95vw] xl:max-w-7xl max-h-[85vh] overflow-hidden p-0 bg-background text-foreground"
        onPointerDownOutside={(e) => {
          // Don't close when clicking dropdown portals (they render outside DialogContent)
          const target = e.target as HTMLElement
          if (target.closest("[data-radix-popper-content-wrapper]") || target.closest("[data-radix-select-viewport]")) {
            e.preventDefault()
            return
          }
        }}
      >
        <DialogHeader className="px-8 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold">
            {mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form — three-column layout */}
        <div className="overflow-y-auto px-8 pb-2" style={{ maxHeight: "calc(85vh - 140px)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-0">

            {/* COLUMN 1: Vehicle Identity + Purchase Info */}
            <div>
              {/* Vehicle Identity */}
              <div className="pb-5 border-b border-border">
                <SectionHeader icon={Car} title="Vehicle Identity" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="make">Make *</Label>
                    <SearchableSelect
                      id="make"
                      value={form.make || ""}
                      onSelect={handleMakeChange}
                      options={makes}
                      placeholder="Select make..."
                      searchPlaceholder="Search makes..."
                    />
                    {errors.make && <p className="text-xs text-destructive">{errors.make}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model">Model *</Label>
                    <SearchableSelect
                      id="model"
                      value={form.model || ""}
                      onSelect={handleModelChange}
                      options={models}
                      placeholder={form.make ? "Select model..." : "Select make first"}
                      searchPlaceholder="Search models..."
                      disabled={!form.make}
                    />
                    {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="year">Year *</Label>
                    <Input id="year" type="number" value={form.year || ""} onChange={(e) => setNumber("year", e.target.value)} placeholder="2023" min={1900} max={currentYear + 1} />
                    {errors.year && <p className="text-xs text-destructive">{errors.year}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="trim">Trim / Variant</Label>
                    <Input id="trim" value={form.trim || ""} onChange={(e) => set("trim", e.target.value)} placeholder="e.g. Competition" />
                  </div>
                </div>
              </div>

              {/* Purchase Information */}
              <div className="py-5">
                <SectionHeader icon={Receipt} title="Purchase Information" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase_price">Price (EUR) *</Label>
                    <Input id="purchase_price" type="number" value={form.purchase_price || ""} onChange={(e) => setNumber("purchase_price", e.target.value)} placeholder="65000" min={0} />
                    {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase_date">Date</Label>
                    <Input id="purchase_date" type="date" value={form.purchase_date || ""} onChange={(e) => set("purchase_date", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase_mileage">Mileage at Purchase</Label>
                    <Input id="purchase_mileage" type="number" value={form.purchase_mileage ?? ""} onChange={(e) => setNumber("purchase_mileage", e.target.value)} placeholder="28000" min={0} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="current_mileage">Current Mileage</Label>
                    <Input id="current_mileage" type="number" value={form.current_mileage ?? ""} onChange={(e) => setNumber("current_mileage", e.target.value)} placeholder="32000" min={0} />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2: Specifications */}
            <div className="border-t border-border lg:border-t-0 lg:border-l lg:pl-8 pt-5 lg:pt-0">
              <div className="flex items-center gap-3">
                <SectionHeader icon={Settings2} title="Specifications" optional />
                {autoFilled && (
                  <span className="text-xs text-primary flex items-center gap-1 animate-in fade-in duration-300">
                    <Sparkles className="h-3 w-3" /> Auto-filled
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>Fuel Type</Label>
                  <Select value={form.fuel_type || ""} onValueChange={(v) => set("fuel_type", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{FUEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Transmission</Label>
                  <Select value={form.transmission || ""} onValueChange={(v) => set("transmission", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{TRANSMISSIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Body Type</Label>
                  <Select value={form.body_type || ""} onValueChange={(v) => set("body_type", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{BODY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Drivetrain</Label>
                  <Select value={form.drivetrain || ""} onValueChange={(v) => set("drivetrain", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{DRIVETRAINS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Exterior Color</Label>
                  <Select value={form.exterior_color || ""} onValueChange={(v) => set("exterior_color", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{EXTERIOR_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Interior Color</Label>
                  <Select value={form.interior_color || ""} onValueChange={(v) => set("interior_color", v || undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{INTERIOR_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="power_kw">Power (kW)</Label>
                  <Input id="power_kw" type="number" value={form.power_kw ?? ""} onChange={(e) => setPowerKw(e.target.value)} placeholder="331" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="power_hp">Power (HP)</Label>
                  <Input id="power_hp" type="number" value={form.power_hp ?? ""} onChange={(e) => setPowerHp(e.target.value)} placeholder="450" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="engine_cc">Engine (cc)</Label>
                  <Input id="engine_cc" type="number" value={form.engine_displacement_cc ?? ""} onChange={(e) => setNumber("engine_displacement_cc", e.target.value)} placeholder="2998" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label>Doors</Label>
                  <Select value={form.num_doors?.toString() || ""} onValueChange={(v) => set("num_doors", v ? Number(v) : undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{[2, 3, 4, 5].map((n) => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Seats</Label>
                  <Select value={form.num_seats?.toString() || ""} onValueChange={(v) => set("num_seats", v ? Number(v) : undefined)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{[2, 4, 5, 7, 8, 9].map((n) => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Additional Details */}
            <div className="border-t border-border lg:border-t-0 lg:border-l lg:pl-8 pt-5 lg:pt-0">
              <SectionHeader icon={FileText} title="Additional Details" optional />
              <div className="space-y-1.5 mt-3">
                <Label htmlFor="modifications">Modifications</Label>
                <Textarea id="modifications" value={form.modifications || ""} onChange={(e) => set("modifications", e.target.value)} placeholder="e.g. Akrapovic exhaust, KW coilovers..." rows={4} />
              </div>
              <div className="space-y-1.5 mt-3">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes..." rows={4} />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border bg-background/50 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : mode === "add" ? "Add Vehicle" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
