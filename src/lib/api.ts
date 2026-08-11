import type {
  AnalysisResult,
  AnalysisStageEvent,
  CuratedFoodRecord,
  FinalizeCorrections,
  LabelRecordValidation,
  Market,
  UnlabeledFoodCatalogResponse,
  UnlabeledFoodIdentifyResponse,
  UnlabeledFoodRecordRequest,
} from '../domain/types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const BACKEND_UNAVAILABLE_MESSAGE = `Backend unavailable at ${API_BASE}. Check Docker/uvicorn and retry.`

export interface AnalysisImages {
  nutrition: File
  ingredients?: File
  front?: File
}

export interface BackendHealth {
  ok: boolean
  message: string
  baseUrl: string
}

export async function createAnalysis(
  images: AnalysisImages,
  market: Market,
  barcode?: string,
): Promise<string> {
  const body = new FormData()
  body.append('nutrition_image', images.nutrition)
  if (images.ingredients) body.append('ingredient_image', images.ingredients)
  if (images.front) body.append('front_image', images.front)
  body.append('market', market)
  if (barcode) body.append('barcode', barcode)

  const response = await fetchApi(`${API_BASE}/api/v1/analyses`, { method: 'POST', body })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not start analysis.'))
  const payload = (await response.json()) as { analysisId: string }
  return payload.analysisId
}

export function streamAnalysis(
  analysisId: string,
  onEvent: (event: AnalysisStageEvent) => void,
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(`${API_BASE}/api/v1/analyses/${analysisId}/events`)
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as AnalysisStageEvent
      onEvent(event)
      if (event.type === 'result' && event.result) {
        source.close()
        resolve(event.result)
      }
      if (event.type === 'error') {
        source.close()
        reject(new Error(event.message ?? 'Analysis failed.'))
      }
    }
    source.onerror = () => {
      source.close()
      reject(new Error(`${BACKEND_UNAVAILABLE_MESSAGE} The analysis stream disconnected; your images and barcode are still available to retry.`))
    }
  })
}

export async function finalizeAnalysis(
  analysisId: string,
  corrections: FinalizeCorrections,
): Promise<AnalysisResult> {
  const response = await fetchApi(`${API_BASE}/api/v1/analyses/${analysisId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corrections),
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not confirm this result.'))
  return response.json() as Promise<AnalysisResult>
}

export async function validateLabelRecord(
  corrections: FinalizeCorrections,
): Promise<LabelRecordValidation> {
  const response = await fetchApi(`${API_BASE}/api/v1/label-records/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corrections),
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not validate this record.'))
  return response.json() as Promise<LabelRecordValidation>
}

export async function getUnlabeledFoodCatalog(market: Extract<Market, 'PH'>): Promise<UnlabeledFoodCatalogResponse> {
  const response = await fetchApi(`${API_BASE}/api/v1/unlabeled-foods/catalog?market=${encodeURIComponent(market)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not load the curated demo catalog.'))
  return response.json() as Promise<UnlabeledFoodCatalogResponse>
}

export async function identifyUnlabeledFood(
  foodImage: File,
  market: Extract<Market, 'PH'>,
): Promise<UnlabeledFoodIdentifyResponse> {
  const body = new FormData()
  body.append('food_image', foodImage)
  body.append('market', market)

  const response = await fetchApi(`${API_BASE}/api/v1/unlabeled-foods/identify`, { method: 'POST', body })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not identify a curated demo candidate.'))
  return response.json() as Promise<UnlabeledFoodIdentifyResponse>
}

export async function validateUnlabeledFoodRecord(
  request: UnlabeledFoodRecordRequest,
): Promise<CuratedFoodRecord> {
  const response = await fetchApi(`${API_BASE}/api/v1/unlabeled-food-records/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not validate this curated demo record.'))
  return response.json() as Promise<CuratedFoodRecord>
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  await fetchApi(`${API_BASE}/api/v1/analyses/${analysisId}`, { method: 'DELETE', keepalive: true })
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const response = await fetchApi(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' })
    if (!response.ok) {
      return {
        ok: false,
        message: `Backend responded with HTTP ${response.status} at ${API_BASE}. Check Docker/uvicorn and retry.`,
        baseUrl: API_BASE,
      }
    }
    return { ok: true, message: `Backend reachable at ${API_BASE}.`, baseUrl: API_BASE }
  } catch (caught) {
    return {
      ok: false,
      message: caught instanceof Error ? caught.message : BACKEND_UNAVAILABLE_MESSAGE,
      baseUrl: API_BASE,
    }
  }
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (caught) {
    if (caught instanceof TypeError) throw new Error(BACKEND_UNAVAILABLE_MESSAGE)
    throw caught
  }
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? fallback
  } catch {
    return fallback
  }
}
