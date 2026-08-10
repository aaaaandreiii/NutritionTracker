import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import AboutPage from './components/mvp/AboutPage'
import AppShell, { type RouteName } from './components/mvp/AppShell'
import HistoryPage from './components/mvp/HistoryPage'
import ScanPage from './components/mvp/ScanPage'
import TodayPage from './components/mvp/TodayPage'
import { createInitialScanSession } from './domain/scanSession'
import { deleteAnalysis } from './lib/api'

const ROUTES: RouteName[] = ['scan', 'today', 'history', 'about']

function routeFromHash(): RouteName {
  const route = window.location.hash.replace(/^#\/?/, '') as RouteName
  return ROUTES.includes(route) ? route : 'scan'
}

export default function App() {
  const [route, setRoute] = useState<RouteName>(routeFromHash)
  const [toast, setToast] = useState<string | null>(null)
  const [scanSession, setScanSession] = useState(createInitialScanSession)

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#/scan')
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
    window.location.hash = `#/${next}`
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logged = async () => {
    if (scanSession.analysisId) await deleteAnalysis(scanSession.analysisId).catch(() => undefined)
    setScanSession(createInitialScanSession())
    setToast('Confirmed label values saved on this device.')
    window.setTimeout(() => setToast(null), 4200)
    navigate('today')
  }

  return (
    <AppShell route={route} navigate={navigate}>
      {toast && <div className="toast"><CheckCircle2 size={18} /> {toast}</div>}
      {route === 'scan' && <ScanPage session={scanSession} setSession={setScanSession} onLogged={logged} />}
      {route === 'today' && <TodayPage onScan={() => navigate('scan')} />}
      {route === 'history' && <HistoryPage onScan={() => navigate('scan')} />}
      {route === 'about' && <AboutPage />}
    </AppShell>
  )
}
