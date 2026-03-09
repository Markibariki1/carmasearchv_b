"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Home, Search, TrendingUp, Bell, Settings, HelpCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface MobileMenuBProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenuB({ isOpen, onClose }: MobileMenuBProps) {
  const router = useRouter()

  const menuItems = [
    { icon: Home, label: "Home", action: () => router.push("/b") },
    { icon: Search, label: "Compare Vehicles", action: () => router.push("/b") },
    { icon: TrendingUp, label: "Portfolio", action: () => router.push("/portfolio") },
    { icon: Bell, label: "Price Alerts", action: () => router.push("/alerts") },
    { icon: Settings, label: "Settings", action: () => router.push("/settings") },
    { icon: HelpCircle, label: "Help & Support", action: () => router.push("/help") },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="theme-b sm:max-w-xs p-0 gap-0 bg-background border border-border rounded-2xl shadow-xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <span className="font-bold text-lg">Menu</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <div className="p-3">
          {menuItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-foreground hover:bg-muted rounded-xl"
              onClick={() => {
                item.action()
                onClose()
              }}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          ))}
        </div>

        <div className="p-5 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">CARMA v1.0.0</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
