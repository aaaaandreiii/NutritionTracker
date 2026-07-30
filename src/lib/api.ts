import type { AnalysisResult, AnalysisStageEvent, FinalizeCorrections, Market } from '../domain/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface AnalysisImages {
  nutrition: File
  ingredients?: File
  front?: File
}

export async function createAnalysis(images: AnalysisImages, market: Market, barcode?: string): Promise<string> {
  const body = new FormData()
  body.append('nutrition_image', images.nutrition)
  if (images.ingredients) body.append('ingredient_image', images.ingredients)
  if (images.front) body.append('front_image', images.front)
  body.append('market', market)
  if (barcode) body.append('barcode', barcode)

  const response = await fetch(`${API_BASE}/api/v1/analyses`, { method: 'POST', body })
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
      reject(new Error('The analysis service disconnected. Your image was not replaced with sample data.'))
    }
  })
}

export async function finalizeAnalysis(
  analysisId: string,
  corrections: FinalizeCorrections,
): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/v1/analyses/${analysisId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corrections),
  })
  if (!response.ok) throw new Error(await responseMessage(response, 'Could not confirm this result.'))
  return response.json() as Promise<AnalysisResult>
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/analyses/${analysisId}`, { method: 'DELETE', keepalive: true })
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? fallback
  } catch {
    return fallback
  }
}
