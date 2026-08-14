import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import AboutPage from './mvp/AboutPage'
import AskPage from './mvp/AskPage'
import AppShell, { type RouteName } from './mvp/AppShell'
import HistoryPage from './mvp/HistoryPage'
import ScanPage from './mvp/ScanPage'
import TodayPage from './mvp/TodayPage'
import { createInitialScanSession, scanWorkflowStep } from '../domain/scanSession'
import type { LogEntry } from '../domain/types'
import { deleteAnalysis } from '../lib/api'
import './mvp/sugar-pai.css'

const ROUTES: RouteName[] = ['ask', 'scan', 'today', 'history', 'about']
const BASE = 'sugar-pai'

function routeFromHash(): RouteName {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path === BASE || path === `${BASE}/`) return 'scan'
  const [, route] = path.split('/')
  return ROUTES.includes(route as RouteName) ? route as RouteName : 'scan'
}

function normalizeSugarPaiHash() {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path === BASE || path === `${BASE}/`) {
    window.history.replaceState(null, '', `#/${BASE}/scan`)
  }
}

interface Props {
  triggerToast?: (message: string, type?: string) => void
  onLogMeal?: (entry: LogEntry) => void
}

export default function SugarPAIApp({ triggerToast, onLogMeal }: Props) {
  const [route, setRoute] = useState<RouteName>(routeFromHash)
  const [toast, setToast] = useState<string | null>(null)
  const [scanSession, setScanSession] = useState(createInitialScanSession)
  const [focusMode, setFocusMode] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)

  useEffect(() => {
    normalizeSugarPaiHash()
    const onHashChange = () => {
      normalizeSugarPaiHash()
      setRoute(routeFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const analysisId = scanSession.analysisId
    if (!analysisId) return
    const onPageHide = () => {
      void deleteAnalysis(analysisId).catch(() => undefined)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [scanSession.analysisId])

  const navigate = (next: RouteName) => {
    const hasUnsavedScan = route === 'scan'
      && scanSession.result?.status !== 'confirmed'
      && Boolean(scanSession.result || scanSession.barcode || Object.keys(scanSession.images).length)
    if (next !== 'scan' && hasUnsavedScan && !window.confirm('Leave this label workflow? Your unvalidated capture will stay in this tab, but it has not been saved.')) return
    window.location.hash = `#/${BASE}/${next}`
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const workflowStep = scanWorkflowStep(scanSession)
  const workflowActive = workflowStep > 0 && scanSession.result?.status !== 'confirmed'

  useEffect(() => {
    document.documentElement.dataset.sugarPaiUnsaved = workflowActive ? 'true' : 'false'
    return () => { delete document.documentElement.dataset.sugarPaiUnsaved }
  }, [workflowActive])

  useEffect(() => {
    document.documentElement.classList.toggle('sugar-pai-focus-active', focusMode)
    return () => document.documentElement.classList.remove('sugar-pai-focus-active')
  }, [focusMode])

  const logged = async (entry: LogEntry) => {
    if (scanSession.analysisId) await deleteAnalysis(scanSession.analysisId).catch(() => undefined)
    setScanSession(createInitialScanSession())
    onLogMeal?.(entry)
    const message = 'Confirmed label values saved on this device.'
    setToast(message)
    triggerToast?.(message, 'success')
    window.setTimeout(() => setToast(null), 4200)
    navigate('today')
  }

  return (
    <div className="sugar-pai-embed">
      <AppShell route={route} navigate={navigate} workflowStep={workflowStep} workflowActive={workflowActive} focusMode={focusMode} composerFocused={composerFocused}>
        {toast && <div className="toast"><CheckCircle2 size={18} /> {toast}</div>}
        {route === 'ask' && <AskPage onFocusModeChange={setFocusMode} onComposerFocusChange={setComposerFocused} />}
        {route === 'scan' && <ScanPage session={scanSession} setSession={setScanSession} onLogged={logged} />}
        {route === 'today' && <TodayPage onScan={() => navigate('scan')} />}
        {route === 'history' && <HistoryPage onScan={() => navigate('scan')} />}
        {route === 'about' && <AboutPage />}
      </AppShell>
    </div>
  )
}
