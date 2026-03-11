"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import type { ValuationSnapshot } from "@/types/portfolio"

export function useValuationHistory(vehicleId: string | null) {
  const [history, setHistory] = useState<ValuationSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createBrowserSupabase()

  const fetchHistory = useCallback(async () => {
    if (!user || !vehicleId) {
      setHistory([])
      return
    }

    setLoading(true)

    const { data } = await supabase
      .from("valuation_history")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true })

    setHistory(data ?? [])
    setLoading(false)
  }, [user, vehicleId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, loading, fetchHistory }
}

// Hook to get aggregated portfolio valuation history (all vehicles combined)
export function usePortfolioValuationHistory(vehicleIds: string[]) {
  const [history, setHistory] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createBrowserSupabase()

  const fetchHistory = useCallback(async () => {
    if (!user || vehicleIds.length === 0) {
      setHistory([])
      return
    }

    setLoading(true)

    const { data } = await supabase
      .from("valuation_history")
      .select("*")
      .eq("user_id", user.id)
      .in("vehicle_id", vehicleIds)
      .order("recorded_at", { ascending: true })

    if (!data || data.length === 0) {
      setHistory([])
      setLoading(false)
      return
    }

    // Group by date (day) and sum values
    const byDate = new Map<string, number>()
    for (const row of data) {
      const dateKey = new Date(row.recorded_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + Number(row.market_value))
    }

    setHistory(
      Array.from(byDate.entries()).map(([date, value]) => ({ date, value })),
    )
    setLoading(false)
  }, [user, vehicleIds.join(","), supabase])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, loading, fetchHistory }
}
