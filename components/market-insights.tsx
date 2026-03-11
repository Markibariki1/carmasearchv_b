"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Info, Star, AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"
import type { PortfolioVehicle } from "@/types/portfolio"

interface MarketInsightsProps {
  vehicles: PortfolioVehicle[]
}

interface Insight {
  id: string
  type: "recommendation" | "warning" | "info"
  title: string
  description: string
}

function InsightCard({ insight }: { insight: Insight }) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  const icon = {
    recommendation: <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-[#dc2626] flex-shrink-0" />,
    info: <Info className="h-4 w-4 text-primary flex-shrink-0" />,
  }[insight.type]

  const borderColor = {
    recommendation: "border-l-amber-500",
    warning: "border-l-[#dc2626]",
    info: "border-l-primary",
  }[insight.type]

  return (
    <div className={`p-4 border border-border/50 border-l-4 ${borderColor} rounded-lg`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 text-muted-foreground"
            onClick={() => setIsDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

export function MarketInsights({ vehicles }: MarketInsightsProps) {
  // Compute performance data from real vehicles
  const performers = useMemo(() => {
    return vehicles
      .map((v) => {
        const currentVal = v.current_market_value ?? v.purchase_price
        const gain = currentVal - v.purchase_price
        const gainPercent = v.purchase_price > 0 ? (gain / v.purchase_price) * 100 : 0
        return { ...v, gain, gainPercent }
      })
      .sort((a, b) => Math.abs(b.gainPercent) - Math.abs(a.gainPercent))
  }, [vehicles])

  // Generate rule-based insights from portfolio data
  const insights = useMemo(() => {
    const result: Insight[] = []

    // Appreciating vehicles
    const appreciating = performers.filter((v) => v.gainPercent >= 5)
    if (appreciating.length > 0) {
      const best = appreciating[0]
      result.push({
        id: "appreciate",
        type: "recommendation",
        title: `${best.make} ${best.model} up ${best.gainPercent.toFixed(1)}%`,
        description: `Your ${best.year} ${best.make} ${best.model} has appreciated significantly since purchase. Consider monitoring for an optimal selling window.`,
      })
    }

    // Depreciating vehicles
    const depreciating = performers.filter((v) => v.gainPercent <= -10)
    if (depreciating.length > 0) {
      const worst = depreciating[depreciating.length - 1]
      result.push({
        id: "depreciate",
        type: "warning",
        title: `${worst.make} ${worst.model} down ${Math.abs(worst.gainPercent).toFixed(1)}%`,
        description: `Your ${worst.year} ${worst.make} ${worst.model} has depreciated ${Math.abs(worst.gainPercent).toFixed(1)}% since purchase. This may continue — review your hold strategy.`,
      })
    }

    // High mileage vehicles
    const highMileage = vehicles.filter((v) => (v.current_mileage ?? 0) > 100000)
    if (highMileage.length > 0) {
      result.push({
        id: "mileage",
        type: "warning",
        title: "High mileage impact",
        description: `${highMileage.length} vehicle${highMileage.length > 1 ? "s" : ""} in your portfolio ${highMileage.length > 1 ? "have" : "has"} over 100,000 km, which can accelerate depreciation.`,
      })
    }

    // Vehicles without valuation data
    const noValuation = vehicles.filter((v) => v.current_market_value == null)
    if (noValuation.length > 0) {
      result.push({
        id: "no-val",
        type: "info",
        title: "Valuations pending",
        description: `${noValuation.length} vehicle${noValuation.length > 1 ? "s" : ""} ${noValuation.length > 1 ? "are" : "is"} still awaiting market valuation. This usually completes within a few minutes.`,
      })
    }

    // Portfolio diversification
    if (vehicles.length >= 3) {
      const makes = new Set(vehicles.map((v) => v.make))
      if (makes.size === 1) {
        result.push({
          id: "diversify",
          type: "info",
          title: "Single-brand portfolio",
          description: "All your vehicles are the same make. Diversifying across brands can reduce risk from brand-specific market shifts.",
        })
      }
    }

    // General tip if no specific insights
    if (result.length === 0) {
      result.push({
        id: "general",
        type: "info",
        title: "Portfolio tracking active",
        description: "Market valuations update automatically. Add more vehicle details (fuel type, transmission, mileage) for more accurate pricing.",
      })
    }

    return result
  }, [vehicles, performers])

  if (vehicles.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Portfolio Movers */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Portfolio Movers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performers.slice(0, 5).map((v) => {
              const isUp = v.gainPercent >= 0
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      €{Math.round(v.current_market_value ?? v.purchase_price).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {isUp ? (
                      <TrendingUp className="h-4 w-4 text-gain" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-loss" />
                    )}
                    <span className={`text-sm font-medium whitespace-nowrap ${isUp ? "text-gain" : "text-loss"}`}>
                      {isUp ? "+" : ""}{v.gainPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            Portfolio Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
