"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Plus, Bell, Download } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { useState, useMemo } from "react"
import { PriceAlertModal } from "./price-alert-modal"
import { useToast } from "@/hooks/use-toast"
import type { PortfolioVehicle } from "@/types/portfolio"

interface PortfolioSummaryProps {
  vehicles: PortfolioVehicle[]
  onAddVehicle: () => void
}

export function PortfolioSummary({ vehicles, onAddVehicle }: PortfolioSummaryProps) {
  const [priceAlertOpen, setPriceAlertOpen] = useState(false)
  const { toast } = useToast()

  const metrics = useMemo(() => {
    const totalValue = vehicles.reduce((sum, v) => sum + (v.current_market_value ?? v.purchase_price), 0)
    const totalInvested = vehicles.reduce((sum, v) => sum + v.purchase_price, 0)
    const gainLoss = totalValue - totalInvested
    const gainLossPercentage = totalInvested > 0 ? ((gainLoss / totalInvested) * 100).toFixed(1) : "0.0"
    return { totalValue, totalInvested, gainLoss, gainLossPercentage, isGain: gainLoss >= 0 }
  }, [vehicles])

  // Build chart data from vehicles' valuation timestamps
  // For now: show a single data point per vehicle's last valuation
  // In future: will be replaced with full valuation_history time series
  const chartData = useMemo(() => {
    if (vehicles.length === 0) return []

    // Group vehicles by creation month and show cumulative portfolio value
    const sorted = [...vehicles].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const points: { date: string; value: number; invested: number }[] = []
    let runningValue = 0
    let runningInvested = 0

    for (const v of sorted) {
      runningValue += v.current_market_value ?? v.purchase_price
      runningInvested += v.purchase_price
      const dateLabel = new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      points.push({ date: dateLabel, value: Math.round(runningValue), invested: Math.round(runningInvested) })
    }

    // Add "today" point with current totals
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (points.length > 0 && points[points.length - 1].date !== today) {
      points.push({ date: today, value: Math.round(metrics.totalValue), invested: Math.round(metrics.totalInvested) })
    }

    return points
  }, [vehicles, metrics])

  const yAxisTicks = useMemo(() => {
    if (chartData.length === 0) return []
    const values = chartData.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || max * 0.1 || 1000
    const padding = range * 0.15
    const minVal = Math.floor((min - padding) / 1000) * 1000
    const maxVal = Math.ceil((max + padding) / 1000) * 1000
    const step = Math.ceil((maxVal - minVal) / 5 / 1000) * 1000 || 1000
    const ticks = []
    for (let i = minVal; i <= maxVal; i += step) ticks.push(i)
    return ticks
  }, [chartData])

  const handleExportPortfolio = () => {
    const headers = ["Make", "Model", "Year", "Trim", "Purchase Price", "Market Value", "Gain/Loss", "Gain %", "Mileage", "Fuel", "Transmission", "Condition"]
    const rows = vehicles.map((v) => {
      const val = v.current_market_value ?? v.purchase_price
      const gain = val - v.purchase_price
      const gainPct = v.purchase_price > 0 ? ((gain / v.purchase_price) * 100).toFixed(1) : "0"
      return [
        v.make, v.model, v.year, v.trim || "", v.purchase_price, Math.round(val),
        Math.round(gain), `${gainPct}%`, v.current_mileage || "", v.fuel_type || "", v.transmission || "", v.condition || "",
      ]
    })

    const csvContent = [
      `"CARMA Portfolio Export - ${new Date().toLocaleDateString()}"`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((c) => (typeof c === "number" ? c : `"${c}"`)).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `CARMA_Portfolio_${new Date().toISOString().split("T")[0]}.csv`
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({ title: "Portfolio Exported", description: `${vehicles.length} vehicles exported to CSV.` })
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl lg:text-3xl font-bold whitespace-nowrap">€{Math.round(metrics.totalValue).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Invested</p>
              <p className="text-2xl lg:text-3xl font-bold whitespace-nowrap">€{Math.round(metrics.totalInvested).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gain/Loss</p>
              <div className="flex items-center gap-2">
                {metrics.isGain ? (
                  <TrendingUp className="h-5 w-5 text-gain flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-loss flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`text-2xl lg:text-3xl font-bold whitespace-nowrap ${metrics.isGain ? "text-gain" : "text-loss"}`}>
                    {metrics.isGain ? "+" : "-"}€{Math.round(Math.abs(metrics.gainLoss)).toLocaleString()}
                  </p>
                  <span className={`text-sm whitespace-nowrap ${metrics.isGain ? "text-gain" : "text-loss"}`}>
                    ({metrics.isGain ? "+" : ""}{metrics.gainLossPercentage}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.8} horizontal vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tick={{ fill: "hsl(var(--foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tick={{ fill: "hsl(var(--foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    domain={yAxisTicks.length > 0 ? [yAxisTicks[0], yAxisTicks[yAxisTicks.length - 1]] : ["auto", "auto"]}
                    ticks={yAxisTicks.length > 0 ? yAxisTicks : undefined}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`€${value.toLocaleString()}`, "Portfolio Value"]}
                  />
                  <ReferenceLine y={Math.round(metrics.totalInvested)} yAxisId="right" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              <p>Portfolio chart will appear as you add more vehicles and valuations accumulate.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="flex items-center gap-2 h-12 justify-center whitespace-nowrap" onClick={onAddVehicle}>
              <Plus className="h-4 w-4 flex-shrink-0" />
              Add Vehicle
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 h-12 bg-transparent justify-center whitespace-nowrap"
              onClick={() => setPriceAlertOpen(true)}
            >
              <Bell className="h-4 w-4 flex-shrink-0" />
              Set Price Alert
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 h-12 bg-transparent justify-center whitespace-nowrap"
              onClick={handleExportPortfolio}
              disabled={vehicles.length === 0}
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              Export Portfolio
            </Button>
          </div>
        </CardContent>
      </Card>

      <PriceAlertModal open={priceAlertOpen} onOpenChange={setPriceAlertOpen} />
    </div>
  )
}
