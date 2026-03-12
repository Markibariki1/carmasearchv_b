"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserSupabase } from "@/utils/supabase/client"

interface VehicleSpec {
  fuel_type: string | null
  transmission: string | null
  drive: string | null
  engine_displacement: number | null
  cylinders: number | null
  vehicle_size_class: string | null
  turbo: boolean
  supercharged: boolean
}

export function useVehicleSpecs() {
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [loadingMakes, setLoadingMakes] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Fetch all distinct makes on mount
  useEffect(() => {
    let cancelled = false
    setLoadingMakes(true)
    const supabase = createBrowserSupabase()
    supabase
      .from("vehicle_specs")
      .select("make")
      .order("make")
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          const unique = [...new Set(data.map((r: { make: string }) => r.make))].sort()
          setMakes(unique)
        }
        setLoadingMakes(false)
      })
    return () => { cancelled = true }
  }, [])

  // Fetch models for a given make
  const fetchModels = useCallback((make: string) => {
    if (!make) {
      setModels([])
      return
    }
    setLoadingModels(true)
    const supabase = createBrowserSupabase()
    supabase
      .from("vehicle_specs")
      .select("model")
      .eq("make", make)
      .order("model")
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: { model: string }) => r.model))].sort()
          setModels(unique)
        }
        setLoadingModels(false)
      })
  }, [])

  // Fetch specs for autofill (best match for make + model + optional year)
  const fetchSpecs = useCallback(async (make: string, model: string, year?: number): Promise<VehicleSpec | null> => {
    if (!make || !model) return null
    const supabase = createBrowserSupabase()

    // Try exact year match first
    if (year) {
      const { data } = await supabase
        .from("vehicle_specs")
        .select("fuel_type,transmission,drive,engine_displacement,cylinders,vehicle_size_class,turbo,supercharged")
        .eq("make", make)
        .eq("model", model)
        .eq("year", year)
        .limit(1)
      if (data && data.length > 0) return data[0] as VehicleSpec
    }

    // Fall back to any year for this make+model
    const { data } = await supabase
      .from("vehicle_specs")
      .select("fuel_type,transmission,drive,engine_displacement,cylinders,vehicle_size_class,turbo,supercharged")
      .eq("make", make)
      .eq("model", model)
      .order("year", { ascending: false })
      .limit(1)

    return data && data.length > 0 ? (data[0] as VehicleSpec) : null
  }, [])

  return { makes, models, loadingMakes, loadingModels, fetchModels, fetchSpecs }
}
