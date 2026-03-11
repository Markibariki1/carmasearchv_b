"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import type { PortfolioVehicle, PortfolioVehicleInsert, PortfolioVehicleUpdate } from "@/types/portfolio"
import { getMarketValuation } from "@/lib/portfolio-api"

export function usePortfolio() {
  const [vehicles, setVehicles] = useState<PortfolioVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const supabase = createBrowserSupabase()

  const fetchVehicles = useCallback(async () => {
    if (!user) {
      setVehicles([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from("portfolio_vehicles")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setVehicles([])
    } else {
      setVehicles(data ?? [])
    }

    setLoading(false)
  }, [user, supabase])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const addVehicle = useCallback(
    async (data: PortfolioVehicleInsert): Promise<PortfolioVehicle | null> => {
      if (!user) return null

      const { data: inserted, error: insertError } = await supabase
        .from("portfolio_vehicles")
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return null
      }

      setVehicles((prev) => [inserted, ...prev])
      return inserted
    },
    [user, supabase],
  )

  const updateVehicle = useCallback(
    async (id: string, data: PortfolioVehicleUpdate): Promise<boolean> => {
      if (!user) return false

      const { error: updateError } = await supabase
        .from("portfolio_vehicles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)

      if (updateError) {
        setError(updateError.message)
        return false
      }

      setVehicles((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...data, updated_at: new Date().toISOString() } : v)),
      )
      return true
    },
    [user, supabase],
  )

  const deleteVehicle = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false

      const { error: deleteError } = await supabase
        .from("portfolio_vehicles")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)

      if (deleteError) {
        setError(deleteError.message)
        return false
      }

      setVehicles((prev) => prev.filter((v) => v.id !== id))
      return true
    },
    [user, supabase],
  )

  const refreshValuation = useCallback(
    async (vehicleId: string): Promise<boolean> => {
      if (!user) return false

      const vehicle = vehicles.find((v) => v.id === vehicleId)
      if (!vehicle) return false

      try {
        const valuation = await getMarketValuation({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          mileage_km: vehicle.current_mileage ?? vehicle.purchase_mileage ?? 0,
          body_type: vehicle.body_type ?? undefined,
          transmission: vehicle.transmission ?? undefined,
          fuel_type: vehicle.fuel_type ?? undefined,
          power_kw: vehicle.power_kw ?? undefined,
        })

        if (valuation.sample_size === 0) return false

        const now = new Date().toISOString()

        // Update the vehicle's current market value
        const { error: updateError } = await supabase
          .from("portfolio_vehicles")
          .update({
            current_market_value: valuation.estimated_value,
            market_value_updated_at: now,
            valuation_sample_size: valuation.sample_size,
            updated_at: now,
          })
          .eq("id", vehicleId)
          .eq("user_id", user.id)

        if (updateError) {
          setError(updateError.message)
          return false
        }

        // Insert a valuation history snapshot
        await supabase.from("valuation_history").insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          market_value: valuation.estimated_value,
          sample_size: valuation.sample_size,
          median_price: valuation.median_price,
          min_price: valuation.min_price,
          max_price: valuation.max_price,
        })

        // Update local state
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === vehicleId
              ? {
                  ...v,
                  current_market_value: valuation.estimated_value,
                  market_value_updated_at: now,
                  valuation_sample_size: valuation.sample_size,
                  updated_at: now,
                }
              : v,
          ),
        )

        return true
      } catch {
        return false
      }
    },
    [user, vehicles, supabase],
  )

  // Refresh stale valuations (older than 24h) on load
  useEffect(() => {
    if (!user || vehicles.length === 0) return

    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
    const staleVehicles = vehicles.filter((v) => {
      if (!v.market_value_updated_at) return true
      return new Date(v.market_value_updated_at).getTime() < staleThreshold
    })

    // Refresh up to 3 at a time to avoid overloading
    const toRefresh = staleVehicles.slice(0, 3)
    toRefresh.forEach((v) => refreshValuation(v.id))
  }, [user, vehicles.length]) // Only run when vehicle count changes, not on every vehicles update

  return {
    vehicles,
    loading,
    error,
    fetchVehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    refreshValuation,
  }
}
