"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Eye, Edit, Trash2, Search, Filter, Plus, RefreshCw, Loader2 } from "lucide-react"
import { useState, useMemo } from "react"
import { VehicleDetailsModal } from "./vehicle-details-modal"
import { AddVehicleWizard } from "./add-vehicle-wizard"
import { useToast } from "@/hooks/use-toast"
import type { PortfolioVehicle, PortfolioVehicleInsert, PortfolioVehicleUpdate } from "@/types/portfolio"

interface VehicleListProps {
  vehicles: PortfolioVehicle[]
  onDelete: (id: string) => Promise<boolean>
  onUpdate: (id: string, data: PortfolioVehicleUpdate) => Promise<boolean>
  onRefreshValuation: (id: string) => Promise<boolean>
  onAddVehicle: () => void
}

function VehicleCard({
  vehicle,
  onDelete,
  onUpdate,
  onRefreshValuation,
}: {
  vehicle: PortfolioVehicle
  onDelete: (id: string) => Promise<boolean>
  onUpdate: (id: string, data: PortfolioVehicleUpdate) => Promise<boolean>
  onRefreshValuation: (id: string) => Promise<boolean>
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const currentVal = vehicle.current_market_value ?? vehicle.purchase_price
  const gainLoss = currentVal - vehicle.purchase_price
  const gainLossPercentage = vehicle.purchase_price > 0 ? ((gainLoss / vehicle.purchase_price) * 100).toFixed(1) : "0.0"
  const isGain = gainLoss >= 0
  const hasValuation = vehicle.current_market_value != null

  const daysOwned = vehicle.purchase_date
    ? Math.floor((Date.now() - new Date(vehicle.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const handleDelete = async () => {
    const confirmed = window.confirm(`Remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your portfolio?`)
    if (!confirmed) return

    setIsDeleting(true)
    const success = await onDelete(vehicle.id)
    if (success) {
      toast({
        title: "Vehicle Removed",
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model} has been removed from your portfolio.`,
      })
    } else {
      toast({ title: "Error", description: "Failed to remove vehicle.", variant: "destructive" })
    }
    setIsDeleting(false)
  }

  const handleEditSubmit = async (data: PortfolioVehicleInsert) => {
    const success = await onUpdate(vehicle.id, data)
    if (!success) throw new Error("Failed to update vehicle")
  }

  return (
    <>
      <Card className="border-border/50 hover:border-primary/50 transition-colors">
        <CardContent className="p-0">
          {/* Color bar instead of image */}
          <div className="h-3 w-full rounded-t-lg bg-gradient-to-r from-primary/60 to-primary/20" />

          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg leading-tight">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              {vehicle.trim && <p className="text-sm text-muted-foreground">{vehicle.trim}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Market Value</p>
                {hasValuation ? (
                  <p className="font-semibold whitespace-nowrap">€{Math.round(currentVal).toLocaleString()}</p>
                ) : (
                  <p className="font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calculating
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Purchase Price</p>
                <p className="font-semibold whitespace-nowrap">€{Math.round(vehicle.purchase_price).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isGain ? (
                  <TrendingUp className="h-4 w-4 text-gain flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss flex-shrink-0" />
                )}
                <span className={`${isGain ? "text-gain" : "text-loss"} whitespace-nowrap`}>
                  {isGain ? "+" : "-"}€{Math.round(Math.abs(gainLoss)).toLocaleString()}
                </span>
                <Badge
                  variant={isGain ? "default" : "destructive"}
                  className={`text-xs ${isGain ? "bg-gain text-white" : "bg-loss text-white"}`}
                >
                  {isGain ? "+" : ""}{gainLossPercentage}%
                </Badge>
              </div>
              {daysOwned > 0 && (
                <div className="text-muted-foreground text-xs whitespace-nowrap">{daysOwned}d owned</div>
              )}
            </div>

            {(vehicle.current_mileage || vehicle.fuel_type || vehicle.transmission) && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {vehicle.current_mileage && <span>{vehicle.current_mileage.toLocaleString()} km</span>}
                {vehicle.fuel_type && <span>{vehicle.fuel_type}</span>}
                {vehicle.transmission && <span>{vehicle.transmission}</span>}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-transparent text-xs"
                onClick={() => setDetailsOpen(true)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-transparent text-xs"
                onClick={() => setEditOpen(true)}
              >
                <Edit className="h-3 w-3 mr-1" />
                Update
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive bg-transparent px-2"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <VehicleDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        vehicle={vehicle}
        onDelete={onDelete}
        onRefreshValuation={onRefreshValuation}
      />

      <AddVehicleWizard
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEditSubmit}
        initialData={vehicle}
        mode="edit"
      />
    </>
  )
}

export function VehicleList({ vehicles, onDelete, onUpdate, onRefreshValuation, onAddVehicle }: VehicleListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMake, setSelectedMake] = useState("all")
  const [sortBy, setSortBy] = useState("value-desc")
  const [visibleCount, setVisibleCount] = useState(8)

  // Dynamic make options from actual vehicles
  const makeOptions = useMemo(() => {
    const makes = [...new Set(vehicles.map((v) => v.make))].sort()
    return makes
  }, [vehicles])

  const filteredVehicles = useMemo(() => {
    let result = vehicles.filter((vehicle) => {
      if (selectedMake !== "all" && vehicle.make.toLowerCase() !== selectedMake.toLowerCase()) {
        return false
      }
      if (
        searchTerm &&
        !`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false
      }
      return true
    })

    result.sort((a, b) => {
      const aVal = a.current_market_value ?? a.purchase_price
      const bVal = b.current_market_value ?? b.purchase_price
      const aGain = aVal - a.purchase_price
      const bGain = bVal - b.purchase_price

      switch (sortBy) {
        case "value-desc": return bVal - aVal
        case "value-asc": return aVal - bVal
        case "gain-desc": return bGain - aGain
        case "gain-asc": return aGain - bGain
        case "date-desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "date-asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        default: return 0
      }
    })

    return result
  }, [vehicles, selectedMake, searchTerm, sortBy])

  return (
    <div className="space-y-4">
      {/* Header with Search and Filters */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Portfolio Vehicles</CardTitle>
            <Button size="sm" onClick={onAddVehicle}>
              <Plus className="h-4 w-4 mr-1" />
              Add Vehicle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedMake} onValueChange={setSelectedMake}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Make" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Makes</SelectItem>
                  {makeOptions.map((make) => (
                    <SelectItem key={make} value={make.toLowerCase()}>{make}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="value-desc">Value (High to Low)</SelectItem>
                  <SelectItem value="value-asc">Value (Low to High)</SelectItem>
                  <SelectItem value="gain-desc">Gain (High to Low)</SelectItem>
                  <SelectItem value="gain-asc">Loss (High to Low)</SelectItem>
                  <SelectItem value="date-desc">Recently Added</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Grid */}
      {filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVehicles.slice(0, visibleCount).map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onRefreshValuation={onRefreshValuation}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No vehicles match your search.</p>
        </div>
      )}

      {/* Load More */}
      {visibleCount < filteredVehicles.length && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="lg" onClick={() => setVisibleCount((prev) => prev + 8)}>
            Load More ({filteredVehicles.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}
