"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  TrendingUp, TrendingDown, Calendar, Gauge, FileText, Edit, Trash2,
  RefreshCw, Plus, Fuel, Settings2, Palette, Car, Loader2, Wrench,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useToast } from "@/hooks/use-toast"
import { useServiceRecords } from "@/hooks/use-service-records"
import { useValuationHistory } from "@/hooks/use-valuation-history"
import { AddServiceRecordForm } from "./add-service-record-form"
import { VehicleMediaSection } from "./vehicle-media-section"
import type { PortfolioVehicle, ServiceRecordInsert } from "@/types/portfolio"

interface VehicleDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: PortfolioVehicle | null
  onDelete: (id: string) => Promise<boolean>
  onRefreshValuation: (id: string) => Promise<boolean>
}

export function VehicleDetailsModal({
  open,
  onOpenChange,
  vehicle,
  onDelete,
  onRefreshValuation,
}: VehicleDetailsModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddService, setShowAddService] = useState(false)
  const { toast } = useToast()
  const { records, totalSpent, addRecord } = useServiceRecords(vehicle?.id ?? null)
  const { history } = useValuationHistory(vehicle?.id ?? null)

  if (!vehicle) return null

  const currentVal = vehicle.current_market_value ?? vehicle.purchase_price
  const gainLoss = currentVal - vehicle.purchase_price
  const gainLossPercentage = vehicle.purchase_price > 0 ? ((gainLoss / vehicle.purchase_price) * 100).toFixed(1) : "0.0"
  const isGain = gainLoss >= 0
  const hasValuation = vehicle.current_market_value != null

  const daysOwned = vehicle.purchase_date
    ? Math.floor((Date.now() - new Date(vehicle.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const chartData = history.map((h) => ({
    date: new Date(h.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Number(h.market_value),
  }))

  const handleRefresh = async () => {
    setIsRefreshing(true)
    const success = await onRefreshValuation(vehicle.id)
    toast({
      title: success ? "Valuation Updated" : "Valuation Failed",
      description: success
        ? "Market value has been refreshed with latest data."
        : "Could not find enough market data. Try again later.",
      variant: success ? "default" : "destructive",
    })
    setIsRefreshing(false)
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(`Remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your portfolio?`)
    if (!confirmed) return

    setIsDeleting(true)
    const success = await onDelete(vehicle.id)
    if (success) {
      toast({ title: "Vehicle Removed", description: `${vehicle.year} ${vehicle.make} ${vehicle.model} removed.` })
      onOpenChange(false)
    } else {
      toast({ title: "Error", description: "Failed to remove vehicle.", variant: "destructive" })
    }
    setIsDeleting(false)
  }

  const handleAddServiceRecord = async (data: ServiceRecordInsert) => {
    const result = await addRecord(data)
    if (result) {
      toast({ title: "Service Record Added", description: `${data.service_type} has been logged.` })
      setShowAddService(false)
    } else {
      toast({ title: "Error", description: "Failed to add service record.", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-b max-w-5xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim && <span className="text-muted-foreground font-normal"> {vehicle.trim}</span>}
            </DialogTitle>
            <Badge
              variant={isGain ? "default" : "destructive"}
              className={`${isGain ? "bg-gain text-white" : "bg-loss text-white"} text-sm shrink-0 ml-3`}
            >
              {isGain ? "+" : ""}{gainLossPercentage}%
            </Badge>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 overflow-y-auto max-h-[calc(95vh-160px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Market Value</p>
                  {hasValuation ? (
                    <p className="text-xl font-bold">€{Math.round(currentVal).toLocaleString()}</p>
                  ) : (
                    <p className="text-xl font-bold text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Pending
                    </p>
                  )}
                </div>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
                  <p className="text-xl font-bold">€{Math.round(vehicle.purchase_price).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    {isGain ? <TrendingUp className="h-3 w-3 text-gain" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                    <p className="text-xs text-muted-foreground">Gain/Loss</p>
                  </div>
                  <p className={`text-xl font-bold ${isGain ? "text-gain" : "text-loss"}`}>
                    {isGain ? "+" : "-"}€{Math.round(Math.abs(gainLoss)).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Days Owned</p>
                  </div>
                  <p className="text-xl font-bold">{daysOwned}</p>
                </div>
              </div>

              {/* Vehicle Specs */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Vehicle Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {vehicle.current_mileage && (
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.current_mileage.toLocaleString()} km</span>
                    </div>
                  )}
                  {vehicle.fuel_type && (
                    <div className="flex items-center gap-2">
                      <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.fuel_type}</span>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.transmission}</span>
                    </div>
                  )}
                  {vehicle.body_type && (
                    <div className="flex items-center gap-2">
                      <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.body_type}</span>
                    </div>
                  )}
                  {vehicle.exterior_color && (
                    <div className="flex items-center gap-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.exterior_color} ext.</span>
                    </div>
                  )}
                  {vehicle.interior_color && (
                    <div className="flex items-center gap-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.interior_color} int.</span>
                    </div>
                  )}
                  {vehicle.power_kw && (
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.power_kw} kW / {vehicle.power_hp ?? Math.round(vehicle.power_kw * 1.36)} HP</span>
                    </div>
                  )}
                  {vehicle.drivetrain && (
                    <div className="flex items-center gap-2">
                      <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{vehicle.drivetrain}</span>
                    </div>
                  )}
                  {vehicle.vin && (
                    <div className="flex items-center gap-2 col-span-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{vehicle.vin}</span>
                    </div>
                  )}
                </div>

                {vehicle.condition && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Condition:</span>
                    <Badge variant="outline">{vehicle.condition}</Badge>
                  </div>
                )}

                {vehicle.modifications && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Modifications</p>
                    <p className="text-foreground">{vehicle.modifications}</p>
                  </div>
                )}

                {vehicle.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground">{vehicle.notes}</p>
                  </div>
                )}
              </div>

              {/* Market Stats */}
              {hasValuation && vehicle.valuation_sample_size && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Market Data</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">Sample Size</p>
                      <p className="font-semibold">{vehicle.valuation_sample_size} vehicles</p>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="font-semibold">
                        {vehicle.market_value_updated_at
                          ? new Date(vehicle.market_value_updated_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Price History Chart */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Valuation History</h3>
                {chartData.length > 1 ? (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                          width={55}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [`€${value.toLocaleString()}`, "Value"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm bg-muted/30 rounded-lg">
                    <p>Valuation history will appear after the first market refresh.</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Service Records */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Service Records
                    {records.length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        (€{Math.round(totalSpent).toLocaleString()} total)
                      </span>
                    )}
                  </h3>
                  {!showAddService && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddService(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                {showAddService && (
                  <div className="mb-3">
                    <AddServiceRecordForm
                      vehicleId={vehicle.id}
                      onSubmit={handleAddServiceRecord}
                      onCancel={() => setShowAddService(false)}
                    />
                  </div>
                )}

                {records.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="flex justify-between items-start p-3 bg-muted/30 rounded-lg text-sm"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="font-medium">{record.service_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.service_date).toLocaleDateString()}
                            {record.mileage_at_service && ` · ${record.mileage_at_service.toLocaleString()} km`}
                            {record.provider && ` · ${record.provider}`}
                          </p>
                        </div>
                        {record.cost != null && (
                          <p className="font-semibold text-right shrink-0">€{record.cost.toLocaleString()}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No service records yet. Add one to start tracking maintenance.</p>
                )}
              </div>

              <Separator />

              {/* Photos & Documents */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Photos & Documents
                </h3>
                <VehicleMediaSection vehicleId={vehicle.id} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-border bg-background/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing || isDeleting}
            >
              {isRefreshing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Refreshing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Refresh Valuation</>
              )}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive bg-transparent flex-shrink-0"
              onClick={handleDelete}
              disabled={isRefreshing || isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
