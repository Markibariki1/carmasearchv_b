"use client"

import { useState, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePortfolio } from "@/hooks/use-portfolio"
import { PortfolioSummary } from "@/components/portfolio-summary"
import { VehicleList } from "@/components/vehicle-list"
import { MarketInsights } from "@/components/market-insights"
import { EmptyPortfolioState } from "@/components/empty-portfolio-state"
import { AddVehicleWizard } from "@/components/add-vehicle-wizard"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  LogIn,
  Settings,
  Star,
  TrendingUp,
  TrendingDown,
  User,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import type { PortfolioVehicle, PortfolioVehicleInsert } from "@/types/portfolio"

const testimonials = [
  {
    quote:
      "I tracked my Porsche 911 with CARMA for eight months. When the market peaked, the platform flagged it and I sold €22,000 above what I'd paid. The alerts genuinely work.",
    name: "Thomas K.",
    location: "Stuttgart, DE",
  },
  {
    quote:
      "The portfolio tracker showed my BMW M3 was steadily appreciating, so I held it longer than I planned. Avoided selling too early by at least €9k. CARMA pays for itself.",
    name: "Anna W.",
    location: "Vienna, AT",
  },
  {
    quote:
      "I buy and sell 10+ cars a year. Having every vehicle in one dashboard with live market data and AI insights is something I didn't know I needed until I had it.",
    name: "Lukas P.",
    location: "Munich, DE",
  },
]

function computeGainPercent(v: PortfolioVehicle): number {
  const currentVal = v.current_market_value ?? v.purchase_price
  if (!v.purchase_price || v.purchase_price <= 0) return 0
  return ((currentVal - v.purchase_price) / v.purchase_price) * 100
}

export default function PortfolioPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { vehicles, loading: portfolioLoading, addVehicle, deleteVehicle, updateVehicle, refreshValuation } = usePortfolio()
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)

  const loading = authLoading || portfolioLoading

  // Computed stats
  const stats = useMemo(() => {
    if (vehicles.length === 0) {
      return { totalValue: 0, totalInvested: 0, gainLoss: 0, gainPercent: 0, vehicleCount: 0, bestPerformer: null as PortfolioVehicle | null, topPerformers: [] as PortfolioVehicle[] }
    }

    const totalValue = vehicles.reduce((sum, v) => sum + (v.current_market_value ?? v.purchase_price), 0)
    const totalInvested = vehicles.reduce((sum, v) => sum + v.purchase_price, 0)
    const gainLoss = totalValue - totalInvested
    const gainPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0

    const sorted = [...vehicles].sort((a, b) => computeGainPercent(b) - computeGainPercent(a))
    const bestPerformer = sorted[0] || null
    const topPerformers = sorted.slice(0, 3)

    return { totalValue, totalInvested, gainLoss, gainPercent, vehicleCount: vehicles.length, bestPerformer, topPerformers }
  }, [vehicles])

  const recentActivity = useMemo(() => {
    return [...vehicles]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4)
      .map((v) => {
        const gain = computeGainPercent(v)
        const age = Date.now() - new Date(v.updated_at).getTime()
        const timeAgo =
          age < 3600000 ? `${Math.max(1, Math.floor(age / 60000))}m ago`
          : age < 86400000 ? `${Math.floor(age / 3600000)}h ago`
          : `${Math.floor(age / 86400000)}d ago`
        return {
          text: `${v.make} ${v.model} — ${gain >= 0 ? "up" : "down"} ${Math.abs(gain).toFixed(1)}%`,
          time: timeAgo,
          positive: gain >= 0,
        }
      })
  }, [vehicles])

  const handleAddVehicle = async (data: PortfolioVehicleInsert) => {
    const result = await addVehicle(data)
    if (result) {
      // Trigger valuation in background
      refreshValuation(result.id)
    }
  }

  // Not authenticated — show sign-in prompt
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="theme-b min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/b">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <Image src="/carma-logo.png" alt="CARMA" width={24} height={24} />
                <span className="font-bold text-lg">Portfolio</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center py-32 px-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <LogIn className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center">Sign in to view your portfolio</h2>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            Track your vehicles, monitor market values, and get personalized insights — all saved to your account.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-12 px-8">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const isGain = stats.gainLoss >= 0

  return (
    <div className="theme-b min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/b">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <Image src="/carma-logo.png" alt="CARMA" width={24} height={24} />
                <span className="font-bold text-lg">Portfolio</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Alerts</span>
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : vehicles.length === 0 ? (
        <main className="container mx-auto px-4 py-8">
          <EmptyPortfolioState onAddVehicle={() => setAddVehicleOpen(true)} />
        </main>
      ) : (
        <>
          {/* Stats overview bar */}
          <section className="border-b border-border bg-muted/40">
            <div className="container mx-auto px-4 py-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Value</p>
                  <p className="text-2xl font-bold">€{Math.round(stats.totalValue).toLocaleString()}</p>
                  <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${isGain ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                    {isGain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isGain ? "+" : ""}{stats.gainPercent.toFixed(1)}% all time
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Gain</p>
                  <p className={`text-2xl font-bold ${isGain ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                    {isGain ? "+" : ""}€{Math.round(Math.abs(stats.gainLoss)).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">vs. €{Math.round(stats.totalInvested).toLocaleString()} invested</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Vehicles</p>
                  <p className="text-2xl font-bold">{stats.vehicleCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {vehicles.filter((v) => computeGainPercent(v) >= 0).length} appreciating
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Best Performer</p>
                  {stats.bestPerformer ? (
                    <>
                      <p className="text-2xl font-bold">{stats.bestPerformer.make} {stats.bestPerformer.model}</p>
                      <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${computeGainPercent(stats.bestPerformer) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                        {computeGainPercent(stats.bestPerformer) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {computeGainPercent(stats.bestPerformer) >= 0 ? "+" : ""}{computeGainPercent(stats.bestPerformer).toFixed(1)}% since purchase
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Main dashboard */}
          <main className="container mx-auto px-4 py-8 space-y-8">
            {/* Chart + Sidebar */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <PortfolioSummary
                  vehicles={vehicles}
                  onAddVehicle={() => setAddVehicleOpen(true)}
                />
              </div>

              <div className="space-y-4">
                {/* Top Performers */}
                <Card className="p-5 border-border">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Top Performers
                  </h3>
                  <div className="space-y-3">
                    {stats.topPerformers.map((v) => {
                      const gain = computeGainPercent(v)
                      return (
                        <div key={v.id} className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{v.make} {v.model}</p>
                            <p className="text-xs text-muted-foreground">€{Math.round(v.current_market_value ?? v.purchase_price).toLocaleString()}</p>
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ml-2 ${gain >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                            {gain >= 0 ? "+" : ""}{gain.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                {/* Recent Activity */}
                <Card className="p-5 border-border">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Recent Activity
                  </h3>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.positive ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-snug">{item.text}</p>
                            <p className="text-xs text-muted-foreground">{item.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No recent activity yet.</p>
                  )}
                </Card>

                {/* Quick tip */}
                {stats.bestPerformer && (
                  <Card className="p-5 border-primary/20 bg-primary/5 border-border">
                    <p className="text-xs font-semibold text-primary mb-1">Portfolio Insight</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {computeGainPercent(stats.bestPerformer) >= 5
                        ? `Your ${stats.bestPerformer.make} ${stats.bestPerformer.model} has appreciated ${computeGainPercent(stats.bestPerformer).toFixed(1)}% since purchase. Consider monitoring the market for an optimal selling window.`
                        : `Keep tracking your portfolio. Market valuations update automatically to help you spot the best time to buy or sell.`}
                    </p>
                  </Card>
                )}
              </div>
            </div>

            {/* Vehicle list */}
            <VehicleList
              vehicles={vehicles}
              onDelete={deleteVehicle}
              onUpdate={updateVehicle}
              onRefreshValuation={refreshValuation}
              onAddVehicle={() => setAddVehicleOpen(true)}
            />

            {/* Market insights */}
            <MarketInsights vehicles={vehicles} />

            {/* Testimonials */}
            <section className="py-12">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  How CARMA users invest smarter
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Real results from people who track their vehicle portfolios with CARMA.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <Card key={t.name} className="p-6 border-border">
                    <div className="flex gap-0.5 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground mb-5">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.location}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* CTA banner */}
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-8 md:p-10 text-center mb-8">
              <h3 className="text-xl md:text-2xl font-bold mb-3">
                Ready to analyze your next vehicle?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Paste any listing URL and get a full AI analysis — price score, market comparison, and deal rating in seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/b">
                  <Button size="lg" className="h-11 px-8">
                    Analyze a Vehicle
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/alerts">
                  <Button size="lg" variant="outline" className="h-11 px-8">
                    <Bell className="mr-2 h-4 w-4" />
                    Set a Price Alert
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Free to use
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  250k+ vehicles tracked
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Real-time data
                </span>
              </div>
            </section>
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image src="/carma-logo.png" alt="CARMA" width={16} height={16} />
              <span>CARMA — Smarter car buying, powered by AI.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/alerts" className="hover:text-foreground transition-colors">Alerts</Link>
              <Link href="/settings" className="hover:text-foreground transition-colors">Settings</Link>
              <Link href="/help" className="hover:text-foreground transition-colors">Help</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Add Vehicle Wizard */}
      <AddVehicleWizard
        open={addVehicleOpen}
        onOpenChange={setAddVehicleOpen}
        onSubmit={handleAddVehicle}
      />
    </div>
  )
}
