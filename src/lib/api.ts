import type {
  AnalysisResult,
  AnalysisStageEvent,
  CuratedFoodRecord,
  FinalizeCorrections,
  LabelRecordValidation,
  Market,
  OffProductLookupResponse,
  UnlabeledFoodCatalogResponse,
  UnlabeledFoodIdentifyResponse,
  UnlabeledFoodRecordRequest,
} from '../domain/types'

const configuredApiBase = import.meta.env.VITE_API_BASE_URL

export const API_BASE = configuredApiBase === 'same-origin'
  ? ''
  : configuredApiBase ?? 'http://localhost:8000'
export const API_BASE_LABEL = API_BASE || 'same-origin backend'

const BACKEND_UNAVAILABLE_MESSAGE = `Backend unavailable at ${API_BASE_LABEL}. Check Docker/uvicorn and retry.`

export interface AnalysisImages {
  nutrition?: File
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
  if (!images.nutrition) throw new Error('Add a readable Nutrition Facts panel to continue.')
  const body = new FormData()
  body.append('nutrition_image', images.nutrition)
  if (images.ingredients) body.append('ingredient_image', images.ingredients)
  if (images.front) body.append('front_image', images.front)
  body.append('market', market)
  if (barcode) body.append('barcode', barcode)

  const response = await fetchApi(`${API_BASE}/api/v1/analyses`, { method: 'POST', body })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not start analysis.'))
  const payload = await jsonResponse<{ analysisId: string }>(response, 'Could not start analysis.')
  return payload.analysisId
}

export async function lookupOffProduct(barcode: string, market: Market): Promise<OffProductLookupResponse> {
  const response = await fetchApi(`${API_BASE}/api/v1/off-products/${encodeURIComponent(barcode)}?market=${encodeURIComponent(market)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not check the local product database.'))
  return jsonResponse<OffProductLookupResponse>(response, 'Could not check the local product database.')
}

export async function createBarcodeAnalysis(barcode: string, market: Market): Promise<AnalysisResult> {
  const response = await fetchApi(`${API_BASE}/api/v1/analyses/barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode, market }),
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not create a database-prefilled analysis.'))
  const payload = await jsonResponse<{ analysisId: string; result: AnalysisResult }>(response, 'Could not create a database-prefilled analysis.')
  return payload.result
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
  return jsonResponse<AnalysisResult>(response, 'Could not confirm this result.')
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
  return jsonResponse<LabelRecordValidation>(response, 'Could not validate this record.')
}

export async function getUnlabeledFoodCatalog(market: Extract<Market, 'PH'>): Promise<UnlabeledFoodCatalogResponse> {
  const response = await fetchApi(`${API_BASE}/api/v1/unlabeled-foods/catalog?market=${encodeURIComponent(market)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not load the curated demo catalog.'))
  return jsonResponse<UnlabeledFoodCatalogResponse>(response, 'Could not load the curated demo catalog.')
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
  return jsonResponse<UnlabeledFoodIdentifyResponse>(response, 'Could not identify a curated demo candidate.')
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
  return jsonResponse<CuratedFoodRecord>(response, 'Could not validate this curated demo record.')
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
        message: `Backend responded with HTTP ${response.status} at ${API_BASE_LABEL}. Check Docker/uvicorn and retry.`,
        baseUrl: API_BASE,
      }
    }
    if (!isJsonResponse(response)) {
      return {
        ok: false,
        message: routeReturnedHtmlMessage('/health'),
        baseUrl: API_BASE,
      }
    }
    return { ok: true, message: `Backend reachable at ${API_BASE_LABEL}.`, baseUrl: API_BASE }
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

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!isJsonResponse(response)) {
    const text = await response.text().catch(() => '')
    if (looksLikeHtml(text)) throw new Error(routeReturnedHtmlMessage(new URL(response.url).pathname))
    throw new Error(fallback)
  }
  try {
    return await response.json() as T
  } catch {
    throw new Error(fallback)
  }
}

function isJsonResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase()
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')
}

function routeReturnedHtmlMessage(path: string): string {
  const route = path.startsWith('/api/') ? '/api/.*' : path
  return `Backend route ${route} returned the frontend page. Check Cloudflare Tunnel path routing so /health and /api/.* point to FastAPI.`
}

async function responseMessage(response: Response, fallback: string) {
  try {
    if (!isJsonResponse(response)) {
      const text = await response.text().catch(() => '')
      if (looksLikeHtml(text)) return routeReturnedHtmlMessage(new URL(response.url).pathname)
      return fallback
    }
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? fallback
  } catch {
    return fallback
  }
}
