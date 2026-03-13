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

  // Fetch all distinct makes via RPC
  useEffect(() => {
    let cancelled = false
    setLoadingMakes(true)
    const supabase = createBrowserSupabase()
    supabase
      .rpc("get_distinct_makes")
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setMakes(data.map((r: { make: string }) => r.make))
        }
        setLoadingMakes(false)
      })
    return () => { cancelled = true }
  }, [])

  // Fetch models for a given make via RPC
  const fetchModels = useCallback((make: string) => {
    if (!make) {
      setModels([])
      return
    }
    setLoadingModels(true)
    const supabase = createBrowserSupabase()
    supabase
      .rpc("get_models_for_make", { p_make: make })
      .then(({ data }) => {
        if (data) {
          setModels(data.map((r: { model: string }) => r.model))
        }
        setLoadingModels(false)
      })
  }, [])

  // Fetch specs for autofill (best match for make + model + optional year)
  const fetchSpecs = useCallback(async (make: string, model: string, year?: number): Promise<VehicleSpec | null> => {
    if (!make || !model) return null
    const supabase = createBrowserSupabase()

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
