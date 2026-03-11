"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X } from "lucide-react"
import { SERVICE_TYPES } from "@/types/portfolio"
import type { ServiceRecordInsert } from "@/types/portfolio"

interface AddServiceRecordFormProps {
  vehicleId: string
  onSubmit: (data: ServiceRecordInsert) => Promise<void>
  onCancel: () => void
}

export function AddServiceRecordForm({ vehicleId, onSubmit, onCancel }: AddServiceRecordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    service_type: "",
    description: "",
    cost: "",
    service_date: new Date().toISOString().split("T")[0],
    mileage_at_service: "",
    provider: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_type || !form.service_date) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        vehicle_id: vehicleId,
        service_type: form.service_type,
        description: form.description || null,
        cost: form.cost ? Number(form.cost) : null,
        currency: "EUR",
        service_date: form.service_date,
        mileage_at_service: form.mileage_at_service ? Number(form.mileage_at_service) : null,
        provider: form.provider || null,
        notes: form.notes || null,
      })
      // Reset form
      setForm({
        service_type: "",
        description: "",
        cost: "",
        service_date: new Date().toISOString().split("T")[0],
        mileage_at_service: "",
        provider: "",
        notes: "",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">New Service Record</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type *</Label>
          <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date *</Label>
          <Input
            type="date"
            value={form.service_date}
            onChange={(e) => setForm((f) => ({ ...f, service_date: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cost (EUR)</Label>
          <Input
            type="number"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            placeholder="120"
            className="h-9 text-sm"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mileage (km)</Label>
          <Input
            type="number"
            value={form.mileage_at_service}
            onChange={(e) => setForm((f) => ({ ...f, mileage_at_service: e.target.value }))}
            placeholder="32000"
            className="h-9 text-sm"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Provider</Label>
          <Input
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            placeholder="BMW Dealer"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Any details about the service..."
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || !form.service_type}>
          <Plus className="h-3 w-3 mr-1" />
          {isSubmitting ? "Saving..." : "Add Record"}
        </Button>
      </div>
    </form>
  )
}
