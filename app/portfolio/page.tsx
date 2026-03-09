"use client"

import { PortfolioSummary } from "@/components/portfolio-summary"
import { VehicleList } from "@/components/vehicle-list"
import { MarketInsights } from "@/components/market-insights"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
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

const topPerformers = [
  { make: "Lamborghini", model: "Huracán EVO", gain: 11.9, value: 235000 },
  { make: "BMW", model: "M3 Competition", gain: 18.2, value: 65000 },
  { make: "Mercedes-AMG", model: "GT 63 S", gain: 7.4, value: 145000 },
]

const recentActivity = [
  { text: "BMW M3 Competition updated", time: "2h ago", positive: true },
  { text: "Market alert: Porsche values up 4%", time: "5h ago", positive: true },
  { text: "Tesla Model S — price dip detected", time: "1d ago", positive: false },
  { text: "Lambo Huracán reached new high", time: "2d ago", positive: true },
]

export default function PortfolioPage() {
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

      {/* Stats overview bar */}
      <section className="border-b border-border bg-muted/40">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Value</p>
              <p className="text-2xl font-bold">€706,000</p>
              <p className="text-xs text-[#16a34a] font-medium mt-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +9.4% all time
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Gain</p>
              <p className="text-2xl font-bold text-[#16a34a]">+€61,000</p>
              <p className="text-xs text-muted-foreground mt-0.5">vs. €645,000 invested</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Vehicles</p>
              <p className="text-2xl font-bold">6</p>
              <p className="text-xs text-muted-foreground mt-0.5">4 appreciating</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Best Performer</p>
              <p className="text-2xl font-bold">BMW M3</p>
              <p className="text-xs text-[#16a34a] font-medium mt-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +18.2% since purchase
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main dashboard */}
      <main className="container mx-auto px-4 py-8 space-y-8">

        {/* Chart + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chart — takes 2/3 */}
          <div className="xl:col-span-2">
            <PortfolioSummary />
          </div>

          {/* Sidebar — 1/3 */}
          <div className="space-y-4">
            {/* Top Performers */}
            <Card className="p-5 border-border">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Top Performers
              </h3>
              <div className="space-y-3">
                {topPerformers.map((v) => (
                  <div key={v.model} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{v.make} {v.model}</p>
                      <p className="text-xs text-muted-foreground">€{v.value.toLocaleString()}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#16a34a] shrink-0 ml-2">
                      +{v.gain}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-5 border-border">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Recent Activity
              </h3>
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
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="w-full mt-3 text-primary hover:text-primary text-xs">
                  View all alerts
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </Card>

            {/* Quick tip */}
            <Card className="p-5 border-primary/20 bg-primary/5 border-border">
              <p className="text-xs font-semibold text-primary mb-1">AI Insight</p>
              <p className="text-sm text-foreground leading-relaxed">
                Your Tesla Model S has depreciated 9.2% this year. Market data suggests values may fall further with the upcoming refresh.
              </p>
              <Button size="sm" variant="outline" className="mt-3 text-xs h-8">
                View full analysis
              </Button>
            </Card>
          </div>
        </div>

        {/* Vehicle list */}
        <VehicleList />

        {/* Market insights */}
        <MarketInsights />

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
    </div>
  )
}
