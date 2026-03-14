"use client"

import { useEffect, useState } from "react"

export default function ExtensionRedirectPage() {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get("redirect")
    if (!encoded) {
      setError("Missing redirect URL. Go back to the homepage and try signing in from the extension again.")
      return
    }
    try {
      const url = decodeURIComponent(encoded)
      if (!url.startsWith("chrome-extension://")) {
        setError("Invalid redirect URL.")
        return
      }
      setRedirectUrl(url)
      window.location.replace(url)
    } catch {
      setError("Invalid redirect URL.")
    }
  }, [])

  if (error) {
    return (
      <div className="theme-b min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        <p className="text-destructive mb-4">{error}</p>
        <a href="/" className="text-primary underline">
          Return to homepage
        </a>
      </div>
    )
  }

  return (
    <div className="theme-b min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <p className="text-lg text-muted-foreground mb-6">
        Taking you back to the CARMA extension…
      </p>
      {redirectUrl && (
        <a
          href={redirectUrl}
          target="_self"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90 underline-offset-4"
        >
          Click here to open the extension
        </a>
      )}
      {!redirectUrl && (
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      )}
    </div>
  )
}
