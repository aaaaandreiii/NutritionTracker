import type { AnalysisImages } from '../lib/api'
import { API_BASE_LABEL } from '../lib/api'
import type { AnalysisResult, AnalysisStageEvent, ImageQualityReport, Market, OffProductLookupResponse } from './types'

export type AnalysisPanelKind = 'nutrition' | 'ingredients' | 'front'
export type PanelKind = AnalysisPanelKind | 'barcode'

export interface ScanServiceStatus {
  state: 'unknown' | 'checking' | 'online' | 'offline'
  message: string
  checkedAt: string | null
}

export interface ScanSessionState {
  images: Partial<AnalysisImages>
  barcodeImage: File | null
  reports: Partial<Record<PanelKind, ImageQualityReport>>
  checking: PanelKind | null
  cameraPanel: PanelKind | null
  market: Market
  barcode: string
  barcodeReading: boolean
  barcodeMessage: string | null
  barcodeLookup: OffProductLookupResponse | null
  barcodeLookupLoading: boolean
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
    barcodeImage: null,
    reports: {},
    checking: null,
    cameraPanel: null,
    market: 'PH',
    barcode: '',
    barcodeReading: false,
    barcodeMessage: null,
    barcodeLookup: null,
    barcodeLookupLoading: false,
    analysisId: null,
    result: null,
    stages: {},
    analyzing: false,
    error: null,
    serviceStatus: {
      state: 'unknown',
      message: `Backend not checked yet at ${API_BASE_LABEL}.`,
      checkedAt: null,
    },
  }
}
