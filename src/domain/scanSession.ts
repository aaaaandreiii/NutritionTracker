import type { AnalysisImages } from '../lib/api'
import { API_BASE } from '../lib/api'
import type { AnalysisResult, AnalysisStageEvent, ImageQualityReport, Market } from './types'

export type PanelKind = 'nutrition' | 'ingredients' | 'front'

export interface ScanServiceStatus {
  state: 'unknown' | 'checking' | 'online' | 'offline'
  message: string
  checkedAt: string | null
}

export interface ScanSessionState {
  images: Partial<AnalysisImages>
  reports: Partial<Record<PanelKind, ImageQualityReport>>
  checking: PanelKind | null
  cameraPanel: PanelKind | null
  market: Market
  barcode: string
  barcodeReading: boolean
  analysisId: string | null
  result: AnalysisResult | null
  stages: Record<string, AnalysisStageEvent>
  analyzing: boolean
  error: string | null
  serviceStatus: ScanServiceStatus
}

export function createInitialScanSession(): ScanSessionState {
  return {
    images: {},
    reports: {},
    checking: null,
    cameraPanel: null,
    market: 'PH',
    barcode: '',
    barcodeReading: false,
    analysisId: null,
    result: null,
    stages: {},
    analyzing: false,
    error: null,
    serviceStatus: {
      state: 'unknown',
      message: `Backend not checked yet at ${API_BASE}.`,
      checkedAt: null,
    },
  }
}
