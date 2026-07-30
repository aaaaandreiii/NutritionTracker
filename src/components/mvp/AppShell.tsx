import { BookOpen, CalendarDays, Camera, History, ScanLine } from 'lucide-react'
import type { ReactNode } from 'react'

export type RouteName = 'scan' | 'today' | 'history' | 'about'

const routes: Array<{ id: RouteName; label: string; icon: typeof Camera }> = [
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'history', label: 'History', icon: History },
  { id: 'about', label: 'About', icon: BookOpen },
]

interface Props {
  route: RouteName
  navigate: (route: RouteName) => void
  children: ReactNode
}

export default function AppShell({ route, navigate, children }: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('scan')} aria-label="Sugar pAI home">
          <span className="brand-mark"><ScanLine size={22} /></span>
          <span>
            <strong>Sugar pAI</strong>
            <small>Evidence-grounded label research</small>
          </span>
        </button>
        <span className="research-badge">Research MVP</span>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {routes.map(({ id, label, icon: Icon }) => (
            <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main>{children}</main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {routes.map(({ id, label, icon: Icon }) => (
          <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
