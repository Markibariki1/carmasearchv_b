import type { ValuationRequest, ValuationResponse } from "@/types/portfolio"

const VALUATION_API_BASE =
  process.env.NEXT_PUBLIC_VALUATION_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://carma-valuation-api.greenwater-7817a41f.northeurope.azurecontainerapps.io"

export async function getMarketValuation(
  req: ValuationRequest,
): Promise<ValuationResponse> {
  const response = await fetch(`${VALUATION_API_BASE}/valuation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })

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
    throw new Error(`Valuation API error: HTTP ${response.status}`)
  }

  return await response.json()
}
