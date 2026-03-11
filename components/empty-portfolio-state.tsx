"use client"

import { Button } from "@/components/ui/button"
import { Car, Plus } from "lucide-react"

interface EmptyPortfolioStateProps {
  onAddVehicle: () => void
}

export function EmptyPortfolioState({ onAddVehicle }: EmptyPortfolioStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Car className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2 text-center">Your portfolio is empty</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Add your first vehicle to start tracking its market value, log service records, and get personalized insights.
      </p>
      <Button size="lg" className="h-12 px-8" onClick={onAddVehicle}>
        <Plus className="h-5 w-5 mr-2" />
        Add Your First Vehicle
      </Button>
    </div>
  )
}
