"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ChevronRight, Check, Car, Receipt, Settings2, FileText } from "lucide-react"
import {
  FUEL_TYPES,
  TRANSMISSIONS,
  BODY_TYPES,
  DRIVETRAINS,
  CONDITIONS,
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

const STEPS = [
  { id: 0, label: "Identity", icon: Car, required: true },
  { id: 1, label: "Purchase", icon: Receipt, required: true },
  { id: 2, label: "Specs", icon: Settings2, required: false },
  { id: 3, label: "Details", icon: FileText, required: false },
]

const currentYear = new Date().getFullYear()

export function AddVehicleWizard({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "add",
}: AddVehicleWizardProps) {
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

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

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {}

    if (s === 0) {
      if (!form.make?.trim()) errs.make = "Make is required"
      if (!form.model?.trim()) errs.model = "Model is required"
      if (!form.year || form.year < 1900 || form.year > currentYear + 1) errs.year = "Enter a valid year"
    }

    if (s === 1) {
      if (!form.purchase_price || form.purchase_price <= 0) errs.purchase_price = "Enter a valid price"
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (!validateStep(step)) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

  const handleSkip = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      setStep(0)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(form as PortfolioVehicleInsert)
      toast({
        title: mode === "add" ? "Vehicle Added" : "Vehicle Updated",
        description: `${form.year} ${form.make} ${form.model} has been ${mode === "add" ? "added to" : "updated in"} your portfolio.`,
      })
      onOpenChange(false)
      // Reset form
      setStep(0)
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

  const isLastStep = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold">
            {mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isDone = i < step
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (i < step || validateStep(step)) setStep(i)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              )
            })}
          </div>
          {!STEPS[step].required && (
            <p className="text-xs text-muted-foreground mt-2">This step is optional — you can skip it.</p>
          )}
        </div>

        {/* Form content */}
        <div className="px-6 pb-2 overflow-y-auto max-h-[calc(90vh-220px)]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  value={form.make || ""}
                  onChange={(e) => set("make", e.target.value)}
                  placeholder="e.g. BMW"
                />
                {errors.make && <p className="text-xs text-destructive">{errors.make}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={form.model || ""}
                  onChange={(e) => set("model", e.target.value)}
                  placeholder="e.g. M3"
                />
                {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    type="number"
                    value={form.year || ""}
                    onChange={(e) => setNumber("year", e.target.value)}
                    placeholder="2023"
                    min={1900}
                    max={currentYear + 1}
                  />
                  {errors.year && <p className="text-xs text-destructive">{errors.year}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trim">Trim / Variant</Label>
                  <Input
                    id="trim"
                    value={form.trim || ""}
                    onChange={(e) => set("trim", e.target.value)}
                    placeholder="e.g. Competition"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="purchase_price">Purchase Price (EUR) *</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  value={form.purchase_price || ""}
                  onChange={(e) => setNumber("purchase_price", e.target.value)}
                  placeholder="65000"
                  min={0}
                />
                {errors.purchase_price && (
                  <p className="text-xs text-destructive">{errors.purchase_price}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={form.purchase_date || ""}
                  onChange={(e) => set("purchase_date", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="purchase_mileage">Mileage at Purchase (km)</Label>
                  <Input
                    id="purchase_mileage"
                    type="number"
                    value={form.purchase_mileage ?? ""}
                    onChange={(e) => setNumber("purchase_mileage", e.target.value)}
                    placeholder="28000"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="current_mileage">Current Mileage (km)</Label>
                  <Input
                    id="current_mileage"
                    type="number"
                    value={form.current_mileage ?? ""}
                    onChange={(e) => setNumber("current_mileage", e.target.value)}
                    placeholder="32000"
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Fuel Type</Label>
                  <Select value={form.fuel_type || ""} onValueChange={(v) => set("fuel_type", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Transmission</Label>
                  <Select value={form.transmission || ""} onValueChange={(v) => set("transmission", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {TRANSMISSIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Body Type</Label>
                  <Select value={form.body_type || ""} onValueChange={(v) => set("body_type", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Drivetrain</Label>
                  <Select value={form.drivetrain || ""} onValueChange={(v) => set("drivetrain", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {DRIVETRAINS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Exterior Color</Label>
                  <Select value={form.exterior_color || ""} onValueChange={(v) => set("exterior_color", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {EXTERIOR_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Interior Color</Label>
                  <Select value={form.interior_color || ""} onValueChange={(v) => set("interior_color", v || undefined)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {INTERIOR_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="power_kw">Power (kW)</Label>
                  <Input
                    id="power_kw"
                    type="number"
                    value={form.power_kw ?? ""}
                    onChange={(e) => setPowerKw(e.target.value)}
                    placeholder="331"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="power_hp">Power (HP)</Label>
                  <Input
                    id="power_hp"
                    type="number"
                    value={form.power_hp ?? ""}
                    onChange={(e) => setPowerHp(e.target.value)}
                    placeholder="450"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="engine_cc">Engine (cc)</Label>
                  <Input
                    id="engine_cc"
                    type="number"
                    value={form.engine_displacement_cc ?? ""}
                    onChange={(e) => setNumber("engine_displacement_cc", e.target.value)}
                    placeholder="2998"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="num_doors">Doors</Label>
                  <Select
                    value={form.num_doors?.toString() || ""}
                    onValueChange={(v) => set("num_doors", v ? Number(v) : undefined)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="num_seats">Seats</Label>
                  <Select
                    value={form.num_seats?.toString() || ""}
                    onValueChange={(v) => set("num_seats", v ? Number(v) : undefined)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {[2, 4, 5, 7, 8, 9].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    value={form.vin || ""}
                    onChange={(e) => set("vin", e.target.value.toUpperCase())}
                    placeholder="WBSWD9C58AP123456"
                    maxLength={17}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="license_plate">License Plate</Label>
                  <Input
                    id="license_plate"
                    value={form.license_plate || ""}
                    onChange={(e) => set("license_plate", e.target.value.toUpperCase())}
                    placeholder="M-AB 1234"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Select value={form.condition || ""} onValueChange={(v) => set("condition", v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modifications">Modifications</Label>
                <Textarea
                  id="modifications"
                  value={form.modifications || ""}
                  onChange={(e) => set("modifications", e.target.value)}
                  placeholder="e.g. Akrapovic exhaust, KW coilovers, carbon fiber diffuser..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Any additional notes about the vehicle..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-background/50">
          <div className="flex items-center justify-between">
            <div>
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack} disabled={isSubmitting}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!STEPS[step].required && !isLastStep && (
                <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isSubmitting}>
                  Skip
                </Button>
              )}
              {isLastStep ? (
                <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
                  {isSubmitting
                    ? "Saving..."
                    : mode === "add"
                      ? "Add Vehicle"
                      : "Save Changes"}
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={isSubmitting} size="sm">
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
