"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import type { VehicleMedia } from "@/types/portfolio"

const BUCKET = "vehicle-media"

export function useVehicleMedia(vehicleId: string | null) {
  const [media, setMedia] = useState<VehicleMedia[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createBrowserSupabase()

  const fetchMedia = useCallback(async () => {
    if (!user || !vehicleId) return
    setLoading(true)

    const { data } = await supabase
      .from("vehicle_media")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setMedia(data ?? [])
    setLoading(false)
  }, [user, vehicleId, supabase])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const uploadFile = useCallback(
    async (file: File, fileType: "image" | "document"): Promise<VehicleMedia | null> => {
      if (!user || !vehicleId) return null

      const ext = file.name.split(".").pop()
      const path = `${user.id}/${vehicleId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type })

      if (uploadError) {
        console.error("Upload failed:", uploadError.message)
        return null
      }

      const { data: inserted, error: insertError } = await supabase
        .from("vehicle_media")
        .insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          file_type: fileType,
          mime_type: file.type,
          file_size: file.size,
        })
        .select()
        .single()

      if (insertError) {
        console.error("Insert failed:", insertError.message)
        return null
      }

      setMedia((prev) => [inserted, ...prev])
      return inserted
    },
    [user, vehicleId, supabase],
  )

  const deleteMedia = useCallback(
    async (mediaId: string): Promise<boolean> => {
      if (!user) return false

      const item = media.find((m) => m.id === mediaId)
      if (!item) return false

      // Delete from storage
      await supabase.storage.from(BUCKET).remove([item.file_path])

      // Delete from database
      const { error } = await supabase
        .from("vehicle_media")
        .delete()
        .eq("id", mediaId)
        .eq("user_id", user.id)

      if (error) return false

      setMedia((prev) => prev.filter((m) => m.id !== mediaId))
      return true
    },
    [user, media, supabase],
  )

  const getPublicUrl = useCallback(
    (filePath: string) => {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
      return data.publicUrl
    },
    [supabase],
  )

  const getSignedUrl = useCallback(
    async (filePath: string): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600) // 1 hour

      if (error) return null
      return data.signedUrl
    },
    [supabase],
  )

  const images = media.filter((m) => m.file_type === "image")
  const documents = media.filter((m) => m.file_type === "document")

  return {
    media,
    images,
    documents,
    loading,
    uploadFile,
    deleteMedia,
    getPublicUrl,
    getSignedUrl,
    refresh: fetchMedia,
  }
}
