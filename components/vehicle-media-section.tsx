"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useVehicleMedia } from "@/hooks/use-vehicle-media"
import { useToast } from "@/hooks/use-toast"
import {
  ImagePlus, FileText, Trash2, Loader2, Upload, X, Download, Eye,
} from "lucide-react"

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp"
const ACCEPTED_DOCS = "application/pdf"
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

interface VehicleMediaSectionProps {
  vehicleId: string
}

export function VehicleMediaSection({ vehicleId }: VehicleMediaSectionProps) {
  const { images, documents, loading, uploadFile, deleteMedia, getSignedUrl } = useVehicleMedia(vehicleId)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      setUploading(true)
      let successCount = 0

      for (const file of fileArray) {
        if (file.size > MAX_SIZE) {
          toast({
            title: "File Too Large",
            description: `${file.name} exceeds 10MB limit.`,
            variant: "destructive",
          })
          continue
        }

        const fileType = file.type.startsWith("image/") ? "image" as const : "document" as const
        const result = await uploadFile(file, fileType)
        if (result) successCount++
      }

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} file${successCount > 1 ? "s" : ""} uploaded.`,
        })
      }
      setUploading(false)
    },
    [uploadFile, toast],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`Delete ${name}?`)
    if (!confirmed) return

    const success = await deleteMedia(id)
    if (success) {
      toast({ title: "Deleted", description: `${name} removed.` })
    } else {
      toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" })
    }
  }

  const handlePreview = async (filePath: string) => {
    const url = await getSignedUrl(filePath)
    if (url) setPreviewUrl(url)
  }

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath)
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={`${ACCEPTED_IMAGES},${ACCEPTED_DOCS}`}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop photos or documents here, or <span className="text-primary font-medium">browse</span>
            </p>
            <p className="text-xs text-muted-foreground/60">JPG, PNG, WebP, PDF up to 10MB</p>
          </div>
        )}
      </div>

      {/* Photos */}
      {images.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ImagePlus className="h-3 w-3" />
            Photos ({images.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/vehicle-media/${img.file_path}`}
                  alt={img.file_name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => handlePreview(img.file_path)}
                  onError={(e) => {
                    // Fallback: try signed URL
                    const el = e.currentTarget
                    getSignedUrl(img.file_path).then((url) => {
                      if (url) el.src = url
                    })
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePreview(img.file_path) }}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(img.id, img.file_name) }}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-red-500/80 text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Documents ({documents.length})
          </h4>
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{doc.file_name}</span>
                  {doc.file_size && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(doc.file_size / 1024).toFixed(0)}KB
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.file_name)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && documents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">No photos or documents yet.</p>
      )}

      {/* Lightbox preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
