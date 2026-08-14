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
  const routeName = route?.split('?')[0]
  return ROUTES.includes(routeName as RouteName) ? routeName as RouteName : 'scan'
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
      && Boolean(scanSession.result || scanSession.barcode || Object.keys(scanSession.images).length)
    if (next !== 'scan' && hasUnsavedScan && !window.confirm('Leave this label workflow? This capture has not been saved to Today.')) return
    window.location.hash = `#/${BASE}/${next}`
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const workflowStep = scanWorkflowStep(scanSession)
  const workflowActive = workflowStep > 0

  const handleWorkflowStep = (step: number) => {
    if (step <= 1 && scanSession.result) {
      setScanSession((previous) => ({
        ...previous,
        result: null,
        stages: {},
        analyzing: false,
        error: null,
      }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

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
    const message = entry.kind === 'estimated_unlabeled_meal'
      ? 'Estimated meal and evidence snapshot saved on this device.'
      : 'Confirmed label values saved on this device.'
    triggerToast?.(message, 'success')
    window.location.hash = `#/${BASE}/today`
    setRoute('today')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="sugar-pai-embed">
      <AppShell route={route} navigate={navigate} workflowStep={workflowStep} workflowActive={workflowActive} focusMode={focusMode} composerFocused={composerFocused} onWorkflowStep={handleWorkflowStep}>
        {route === 'ask' && <AskPage onFocusModeChange={setFocusMode} onComposerFocusChange={setComposerFocused} />}
        {route === 'scan' && <ScanPage session={scanSession} setSession={setScanSession} onLogged={logged} />}
        {route === 'today' && <TodayPage onScan={() => navigate('scan')} />}
        {route === 'history' && <HistoryPage onScan={() => navigate('scan')} />}
        {route === 'about' && <AboutPage />}
      </AppShell>
    </div>
  )
}
