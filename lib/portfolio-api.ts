import type { ValuationRequest, ValuationResponse } from "@/types/portfolio"

const VALUATION_API_BASE =
  process.env.NEXT_PUBLIC_VALUATION_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://carma-valuation-api.greenwater-7817a41f.northeurope.azurecontainerapps.io"

const FETCH_TIMEOUT_MS = 60_000
const RETRY_DELAYS = [2_000, 5_000, 10_000]

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  delays: number[],
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      // Don't retry on client errors (4xx) — only on timeout or server errors
      if (err?.status && err.status >= 400 && err.status < 500) throw err
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]))
      }
    }
  }
  throw lastError
}

export async function getMarketValuation(
  req: ValuationRequest,
): Promise<ValuationResponse> {
  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(
      `${VALUATION_API_BASE}/valuation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      },
      FETCH_TIMEOUT_MS,
    )

    if (!response.ok) {
      if (response.status === 404) {
        return {
          estimated_value: 0,
          median_price: 0,
          mean_price: 0,
          p25: 0,
          p75: 0,
          min_price: 0,
          max_price: 0,
          sample_size: 0,
        }
      }
      const err = new Error(`Valuation API error: HTTP ${response.status}`)
      ;(err as any).status = response.status
      throw err
    }

    return await response.json()
  }, RETRY_DELAYS)
}
