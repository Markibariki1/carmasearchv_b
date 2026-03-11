"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import type { ServiceRecord, ServiceRecordInsert, ServiceRecordUpdate } from "@/types/portfolio"

export function useServiceRecords(vehicleId: string | null) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const supabase = createBrowserSupabase()

  const fetchRecords = useCallback(async () => {
    if (!user || !vehicleId) {
      setRecords([])
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from("service_records")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .order("service_date", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRecords([])
    } else {
      setRecords(data ?? [])
    }

    setLoading(false)
  }, [user, vehicleId, supabase])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const addRecord = useCallback(
    async (data: ServiceRecordInsert): Promise<ServiceRecord | null> => {
      if (!user) return null

      const { data: inserted, error: insertError } = await supabase
        .from("service_records")
        .insert({ ...data, user_id: user.id })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return null
      }

      setRecords((prev) => [inserted, ...prev])
      return inserted
    },
    [user, supabase],
  )

  const updateRecord = useCallback(
    async (id: string, data: ServiceRecordUpdate): Promise<boolean> => {
      if (!user) return false

      const { error: updateError } = await supabase
        .from("service_records")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)

      if (updateError) {
        setError(updateError.message)
        return false
      }

      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data, updated_at: new Date().toISOString() } : r)),
      )
      return true
    },
    [user, supabase],
  )

  const deleteRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false

      const { error: deleteError } = await supabase
        .from("service_records")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)

      if (deleteError) {
        setError(deleteError.message)
        return false
      }

      setRecords((prev) => prev.filter((r) => r.id !== id))
      return true
    },
    [user, supabase],
  )

  const totalSpent = records.reduce((sum, r) => sum + (r.cost ?? 0), 0)

  return {
    records,
    loading,
    error,
    totalSpent,
    fetchRecords,
    addRecord,
    updateRecord,
    deleteRecord,
  }
}
