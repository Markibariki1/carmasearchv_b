"use client"
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingDown,
  User,
  X,
  Zap,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CompareModal } from "@/components/compare-modal"
import { AuthModal } from "@/components/auth-modal-b"
import { MobileMenuB } from "@/components/mobile-menu-b"
import { LogoScrollWheel } from "@/components/logo-scroll-wheel"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getDatabaseStats } from "@/lib/api"

// Animated number that counts up on scroll into view
function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 1500
          const steps = 40
          const increment = target / steps
          const stepDuration = duration / steps
          let current = 0
          const timer = setInterval(() => {
            current++
            if (current >= steps) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(increment * current))
            }
          }, stepDuration)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

const EXTERIOR_COLORS = [
  { name: "Black",  hex: "#1a1a1a" },
  { name: "White",  hex: "#FFFFFF" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gray",   hex: "#808080" },
  { name: "Blue",   hex: "#2563EB" },
  { name: "Red",    hex: "#DC2626" },
  { name: "Green",  hex: "#16a34a" },
  { name: "Brown",  hex: "#8B4513" },
  { name: "Beige",  hex: "#F5F5DC" },
  { name: "Orange", hex: "#F97316" },
  { name: "Yellow", hex: "#EAB308" },
]

const REGISTRATION_YEARS = ["2013","2014","2015","2016","2017","2018","2019","2020","2021","2022","2023","2024","2025"]

const mockResults = [
  { name: "2023 Tesla Model 3 LR", specs: "42,000 km · Silver · AWD · AutoScout24", price: "€42,990", score: 94, delta: -3010 },
  { name: "2023 Tesla Model 3 LR", specs: "38,500 km · White · AWD · Mobile.de",   price: "€43,500", score: 87, delta: -2500 },
  { name: "2023 Tesla Model 3 LR", specs: "44,800 km · Black · AWD · AutoTrader",  price: "€44,800", score: 73, delta: -1200 },
  { name: "2023 Tesla Model 3 LR", specs: "31,000 km · Blue  · AWD · AutoScout24", price: "€47,500", score: 58, delta: 2500  },
  { name: "2023 Tesla Model 3 LR", specs: "22,000 km · Red   · AWD · Mobile.de",   price: "€49,900", score: 41, delta: 4900  },
]

export default function HomePageB() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup")
  const [heroUrl, setHeroUrl] = useState("")
  const [isHeroSearching, setIsHeroSearching] = useState(false)
  const [vehicleCount, setVehicleCount] = useState(2_800_000)
  const [showHeroFilters, setShowHeroFilters] = useState(false)
  const [heroRegFrom, setHeroRegFrom] = useState("")
  const [heroRegUntil, setHeroRegUntil] = useState("")
  const [heroMileFrom, setHeroMileFrom] = useState("")
  const [heroMileUntil, setHeroMileUntil] = useState("")
  const [heroExtColors, setHeroExtColors] = useState<string[]>([])
  const { user, isAuthenticated, signOut } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    getDatabaseStats()
      .then((stats) => {
        if (stats.total_vehicles > 0) setVehicleCount(stats.total_vehicles)
      })
      .catch(() => {/* keep fallback */})
  }, [])

  // Check for auth mode from URL
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const authParam = params.get("auth")
    if (authParam === "login" || authParam === "signup") {
      setAuthMode(authParam)
      setIsAuthModalOpen(true)
    }
  }, [])

  const handleHeroCompare = () => {
    if (!heroUrl.trim()) {
      toast({
        title: "Enter a URL",
        description: "Paste a vehicle listing URL to get started.",
      })
      return
    }
    if (!isAuthenticated) {
      setAuthMode("signup")
      setIsAuthModalOpen(true)
      toast({
        title: "Create a free account",
        description: "Sign up to compare vehicles instantly.",
      })
      return
    }
    setIsCompareModalOpen(true)
  }

  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = "/portfolio"
    } else {
      setAuthMode("signup")
      setIsAuthModalOpen(true)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast({ title: "Signed out", description: "See you next time!" })
    } catch {
      toast({ title: "Error", description: "Could not sign out.", variant: "destructive" })
    }
  }

  return (
    <div className="theme-b min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/carma-logo.png"
                alt="CARMA"
                className="w-8 h-8 animate-spin-slow"
                loading="eager"
              />
              <span className="text-xl font-bold tracking-tight">CARMA</span>
            </div>

            {/* Center: Nav links (desktop) */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Testimonials
              </a>
              <a href="#pricing-section" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
            </div>

            {/* Right: Auth */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (window.location.href = "/portfolio")}
                  >
                    <LayoutDashboard className="h-4 w-4 mr-1.5" />
                    Portfolio
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (window.location.href = "/alerts")}
                  >
                    <Bell className="h-4 w-4 mr-1.5" />
                    Alerts
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="ml-1">
                        <User className="h-4 w-4 mr-1.5" />
                        {user?.email?.split("@")[0]}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 theme-b">
                      <DropdownMenuItem onClick={() => (window.location.href = "/settings")}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuthMode("login")
                      setIsAuthModalOpen(true)
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAuthMode("signup")
                      setIsAuthModalOpen(true)
                    }}
                  >
                    Get Started Free
                  </Button>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Asymmetric split layout */}
      <section className="py-16 md:py-24 px-4 overflow-hidden">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy + inline search */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium rounded-full px-4 py-1.5 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Vehicle Analysis
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-balance">
                Find the best deal on your next car
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Paste any vehicle listing URL and instantly see how it compares
                to thousands of similar cars. AI-powered pricing, deal scores,
                and market analysis — all in seconds.
              </p>

              {/* Inline URL search bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="Paste a vehicle listing URL..."
                    value={heroUrl}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleHeroCompare()}
                    className="pl-10 h-12 text-base border-border bg-background shadow-sm"
                  />
                </div>
                <Button
                  size="lg"
                  className="h-12 px-6 shrink-0"
                  onClick={handleHeroCompare}
                  disabled={isHeroSearching}
                >
                  {isHeroSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Filters toggle */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setShowHeroFilters(!showHeroFilters)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showHeroFilters ? "rotate-180" : ""}`} />
                </button>
                {heroExtColors.length > 0 && (
                  <span className="text-xs text-primary font-medium">
                    {heroExtColors.length} color{heroExtColors.length > 1 ? "s" : ""} selected
                  </span>
                )}
                {(heroRegFrom || heroRegUntil) && (
                  <span className="text-xs text-primary font-medium">
                    {heroRegFrom || "any"}–{heroRegUntil || "any"}
                  </span>
                )}
              </div>

              {/* Inline filter panel */}
              {showHeroFilters && (
                <div className="mb-5 p-4 rounded-xl bg-muted/50 border border-border space-y-4">
                  {/* Year + Mileage row */}
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium w-8">Year</span>
                      <select
                        value={heroRegFrom}
                        onChange={(e) => setHeroRegFrom(e.target.value)}
                        className="h-7 text-xs bg-background border border-border rounded-lg px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">From</option>
                        {REGISTRATION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <span className="text-xs text-muted-foreground">–</span>
                      <select
                        value={heroRegUntil}
                        onChange={(e) => setHeroRegUntil(e.target.value)}
                        className="h-7 text-xs bg-background border border-border rounded-lg px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Until</option>
                        {REGISTRATION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium w-14">Mileage</span>
                      <input
                        type="number"
                        placeholder="From"
                        value={heroMileFrom}
                        onChange={(e) => setHeroMileFrom(e.target.value)}
                        className="h-7 text-xs bg-background border border-border rounded-lg px-2 w-20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="number"
                        placeholder="Until"
                        value={heroMileUntil}
                        onChange={(e) => setHeroMileUntil(e.target.value)}
                        className="h-7 text-xs bg-background border border-border rounded-lg px-2 w-20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground">km</span>
                    </div>
                  </div>

                  {/* Color swatches */}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Exterior Color</p>
                    <div className="flex flex-wrap gap-2">
                      {EXTERIOR_COLORS.map((color) => (
                        <button
                          key={color.name}
                          title={color.name}
                          onClick={() =>
                            setHeroExtColors((prev) =>
                              prev.includes(color.name)
                                ? prev.filter((c) => c !== color.name)
                                : [...prev, color.name]
                            )
                          }
                          className={`w-6 h-6 rounded-full border-2 transition-all duration-150 ${
                            heroExtColors.includes(color.name)
                              ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                              : "border-transparent hover:border-muted-foreground hover:scale-105"
                          } ${color.name === "White" ? "shadow-sm" : ""}`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                      {heroExtColors.length > 0 && (
                        <button
                          onClick={() => setHeroExtColors([])}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-center ml-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Free to start
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No credit card needed
                </span>
              </div>
            </div>

            {/* Right: Hero visual - mock comparison card */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Background decorative gradient */}
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 rounded-3xl" />

                {/* Main card */}
                <Card className="relative p-6 shadow-xl border-border">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-sm font-medium">Live Analysis</span>
                    </div>
                    <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">
                      AI Score: 94/100
                    </span>
                  </div>

                  {/* Vehicle entry 1 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3.5 bg-muted rounded-xl">
                      <img
                        src="/tesla-model-3-2022.jpg"
                        alt="Tesla Model 3"
                        className="w-20 h-14 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">2023 Tesla Model 3 LR</p>
                        <p className="text-xs text-muted-foreground">42,000 km · White · AWD</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">€42,990</p>
                        <p className="text-xs text-[#16a34a] font-medium flex items-center gap-0.5 justify-end">
                          <TrendingDown className="h-3 w-3" />
                          €3,010 below avg
                        </p>
                      </div>
                    </div>

                    {/* Vehicle entry 2 */}
                    <div className="flex items-center gap-4 p-3.5 bg-muted rounded-xl">
                      <div className="w-20 h-14 bg-border rounded-lg flex items-center justify-center">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">2023 BMW 330i Sport</p>
                        <p className="text-xs text-muted-foreground">38,000 km · Black · RWD</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">€45,200</p>
                        <p className="text-xs text-[#dc2626] font-medium">€1,200 above avg</p>
                      </div>
                    </div>

                    {/* Vehicle entry 3 */}
                    <div className="flex items-center gap-4 p-3.5 bg-muted rounded-xl">
                      <div className="w-20 h-14 bg-border rounded-lg flex items-center justify-center">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">2023 Audi A4 Premium+</p>
                        <p className="text-xs text-muted-foreground">29,000 km · Gray · Quattro</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">€43,800</p>
                        <p className="text-xs text-muted-foreground font-medium">At market avg</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Based on 1,247 comparable vehicles
                    </span>
                    <span className="text-xs text-primary font-medium">
                      View full report →
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By / Logo Scroll */}
      <section className="py-6 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Data sourced from leading marketplaces
          </p>
          <LogoScrollWheel
            invert={false}
            logos={[
              { src: '/AutoScout24_primary_solid.png', alt: 'AutoScout24', href: 'https://www.autoscout24.de' },
              { src: '/AutoTrader_logo.svg.png', alt: 'AutoTrader', href: 'https://www.autotrader.com' },
              { src: '/Logo_von_mobile.de_2025-05.svg.png', alt: 'Mobile.de', href: 'https://www.mobile.de' },
              { src: '/Marktplaats.nl-Logo.wine.png', alt: 'Marktplaats', href: 'https://www.marktplaats.nl' },
              { src: '/otomoto_logotyp.png', alt: 'Otomoto', href: 'https://www.otomoto.pl' },
            ]}
          />
        </div>
      </section>

      {/* Stats - Inline horizontal strip */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                {vehicleCount >= 1_000_000
                  ? <CountUp key={vehicleCount} target={Math.floor(vehicleCount / 1_000_000)} suffix={`.${Math.floor((vehicleCount % 1_000_000) / 100_000)}M+`} />
                  : <CountUp key={vehicleCount} target={Math.floor(vehicleCount / 1_000)} suffix="k+" />
                }
              </div>
              <p className="text-sm text-muted-foreground">Vehicles Tracked</p>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">98%</div>
              <p className="text-sm text-muted-foreground">Price Accuracy</p>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                <CountUp target={2} suffix=".5M" />
              </div>
              <p className="text-sm text-muted-foreground">Saved by Users</p>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">24/7</div>
              <p className="text-sm text-muted-foreground">Price Monitoring</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features - 3-column cards */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to buy smarter
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop guessing whether you&apos;re getting a good deal. CARMA gives you
              the data to negotiate with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-8 border-border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">AI Price Analysis</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our machine learning model analyzes 250k+ listings to predict fair market
                value and flag overpriced or underpriced vehicles.
              </p>
            </Card>

            <Card className="p-8 border-border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Instant Comparisons</h3>
              <p className="text-muted-foreground leading-relaxed">
                Paste any listing URL and get side-by-side comparisons with similar
                vehicles ranked by deal quality, similarity, and spec match.
              </p>
            </Card>

            <Card className="p-8 border-border hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Price Drop Alerts</h3>
              <p className="text-muted-foreground leading-relaxed">
                Set alerts for specific models or listings and get notified the moment
                prices drop — so you never miss a great deal.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works - Numbered steps */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three steps to a smarter purchase
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              No spreadsheets, no guesswork. Just paste, analyze, and save.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Paste a Listing URL</h3>
              <p className="text-sm text-muted-foreground">
                Copy the URL of any vehicle listing from AutoScout24, Mobile.de, or
                AutoTrader and paste it into CARMA.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">Get AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our AI instantly evaluates the listing against comparable vehicles
                and predicts a fair market price.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">Save Thousands</h3>
              <p className="text-sm text-muted-foreground">
                Use the deal score and comparable data to negotiate confidently —
                or find a better-priced alternative.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Results Preview */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Live Results Preview
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See exactly what you get
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Every search returns a ranked list of comparable vehicles, each scored
              by our AI on price, condition, and deal quality.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Card className="overflow-hidden border-border shadow-lg">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-muted/60 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium truncate">
                    2023 Tesla Model 3 LR · 42,000 km · AutoScout24
                  </span>
                </div>
                <span className="text-xs text-muted-foreground bg-background px-2.5 py-1 rounded-full border border-border shrink-0 ml-3">
                  12 comparables
                </span>
              </div>

              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-[2rem_1fr_6rem_7rem_8rem] gap-3 px-5 py-2.5 bg-muted/20 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>#</span>
                <span>Vehicle</span>
                <span className="text-right">Price</span>
                <span className="text-center">AI Score</span>
                <span className="text-right">vs. Market</span>
              </div>

              {/* Result rows */}
              {mockResults.map((r, i) => {
                const isTarget = i === 0
                const badgeClass =
                  r.score >= 85
                    ? "bg-[#16a34a]/10 text-[#16a34a]"
                    : r.score >= 70
                    ? "bg-primary/10 text-primary"
                    : r.score >= 55
                    ? "bg-orange-500/10 text-orange-600"
                    : "bg-[#dc2626]/10 text-[#dc2626]"
                const badgeLabel =
                  r.score >= 85 ? "Great Deal" : r.score >= 70 ? "Good Price" : r.score >= 55 ? "Fair" : "Above Market"
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_6rem_7rem_8rem] gap-x-3 gap-y-1 items-center px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${isTarget ? "bg-primary/5" : ""}`}
                  >
                    {/* Rank */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isTarget ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>

                    {/* Name + specs */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold">{r.name}</p>
                        {isTarget && (
                          <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded shrink-0">
                            Your listing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.specs}</p>
                    </div>

                    {/* Price — hidden on mobile, shown in specs row below */}
                    <p className="hidden sm:block text-sm font-bold text-right">{r.price}</p>

                    {/* Score badge */}
                    <div className="hidden sm:flex justify-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badgeClass}`}>
                        {badgeLabel} · {r.score}
                      </span>
                    </div>

                    {/* Delta */}
                    <p
                      className={`hidden sm:block text-xs font-semibold text-right whitespace-nowrap ${
                        r.delta <= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                      }`}
                    >
                      {r.delta <= 0
                        ? `€${Math.abs(r.delta).toLocaleString()} below avg`
                        : `€${r.delta.toLocaleString()} above avg`}
                    </p>

                    {/* Mobile: price + badge + delta inline */}
                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:hidden">
                      <span className="text-sm font-bold">{r.price}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                        {badgeLabel} · {r.score}
                      </span>
                      <span className={`text-xs font-medium ${r.delta <= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                        {r.delta <= 0 ? `€${Math.abs(r.delta).toLocaleString()} below` : `€${r.delta.toLocaleString()} above`}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Panel footer */}
              <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Based on 12 comparable listings · AutoScout24 · Mobile.de · AutoTrader
                </span>
                <span className="text-xs text-primary font-medium shrink-0 ml-3">
                  View full report →
                </span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by smart car buyers
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our users are saying about CARMA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="p-6 border-border">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4">
                &quot;CARMA saved me €4,200 on my BMW 3 Series. The AI flagged that
                the dealer price was well above market average and showed me
                three better deals nearby.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Marcus L.</p>
                  <p className="text-xs text-muted-foreground">Munich, DE</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4">
                &quot;The price alerts are incredible. I set one up for a Porsche
                Taycan and got notified within a week when one dropped €8k.
                Bought it the same day.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Sophie R.</p>
                  <p className="text-xs text-muted-foreground">Vienna, AT</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4">
                &quot;As a used car dealer, CARMA is essential for pricing my
                inventory competitively. The market data is unmatched and
                updates daily.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Jan K.</p>
                  <p className="text-xs text-muted-foreground">Berlin, DE</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing-like CTA section */}
      <section id="pricing-section" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start comparing for free
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Create a free account and analyze your first vehicle in under 30 seconds.
            No credit card required.
          </p>

          <Card className="p-8 md:p-10 border-primary/30 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative">
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold">Free</span>
              </div>
              <p className="text-muted-foreground mb-8">
                Everything you need to make a smart purchase
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto mb-8">
                {[
                  "AI-powered price analysis",
                  "Unlimited vehicle comparisons",
                  "Deal score on every listing",
                  "Price history tracking",
                  "Email price drop alerts",
                  "Export comparison reports",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Button size="lg" className="px-10 h-12 text-base" onClick={handleGetStarted}>
                {isAuthenticated ? "Open Dashboard" : "Get Started Free"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/carma-logo.png" alt="CARMA" className="w-6 h-6" />
              <span className="font-semibold">CARMA</span>
              <span className="text-sm text-muted-foreground">
                — Smarter car buying, powered by AI.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/portfolio" className="hover:text-foreground transition-colors">
                Portfolio
              </a>
              <a href="/alerts" className="hover:text-foreground transition-colors">
                Alerts
              </a>
              <a href="/help" className="hover:text-foreground transition-colors">
                Help
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        className="theme-b"
        initialUrl={heroUrl}
        initialFilters={{
          regFrom: heroRegFrom,
          regUntil: heroRegUntil,
          mileFrom: heroMileFrom,
          mileUntil: heroMileUntil,
          extColors: heroExtColors,
        }}
      />
      <MobileMenuB isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
      />
    </div>
  )
}
