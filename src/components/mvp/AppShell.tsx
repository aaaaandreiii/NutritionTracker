import { CalendarDays, History, Menu, MessageCircleQuestion, ScanLine } from 'lucide-react'
import type { ReactNode } from 'react'

export type RouteName = 'ask' | 'scan' | 'today' | 'history' | 'about'

const routes: Array<{ id: RouteName; label: string; icon: typeof ScanLine }> = [
  { id: 'ask', label: 'Ask', icon: MessageCircleQuestion },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'history', label: 'History', icon: History },
  { id: 'about', label: 'More', icon: Menu },
]

const workflow = ['Identify', 'Evidence', 'Review', 'Context', 'Log']

interface Props {
  route: RouteName
  navigate: (route: RouteName) => void
  children: ReactNode
  workflowStep?: number
  workflowActive?: boolean
  focusMode?: boolean
  composerFocused?: boolean
}

export default function AppShell({
  route,
  navigate,
  children,
  workflowStep = 0,
  workflowActive = false,
  focusMode = false,
  composerFocused = false,
}: Props) {
  return (
    <div className={`app-shell ${focusMode ? 'shell-focus-mode' : ''} ${workflowActive ? 'workflow-active' : ''} ${composerFocused ? 'composer-focused' : ''}`}>
      <header className="topbar">
        <div className="feature-title"><span>Sugar pAI</span><small>Evidence workspace</small></div>
        <span className="research-badge">Research MVP</span>
        <nav className="desktop-nav" aria-label="Sugar pAI navigation">
          {routes.map(({ id, label, icon: Icon }) => (
            <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={16} /> {id === 'about' ? 'About' : label}
            </button>
          ))}
        </nav>
      </header>

      {route === 'scan' && (
        <nav className="workflow-progress" aria-label="Label workflow progress">
          <ol>
            {workflow.map((label, index) => (
              <li key={label} className={index < workflowStep ? 'complete' : index === workflowStep ? 'current' : ''} aria-current={index === workflowStep ? 'step' : undefined}>
                <span>{index < workflowStep ? '✓' : index + 1}</span><small>{label}</small>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <main>{children}</main>

      <nav className="mobile-nav" aria-label="Sugar pAI navigation">
        {routes.map(({ id, label, icon: Icon }) => (
          <button key={id} className={route === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {workflowActive && route === 'scan' && (
        <div className="mobile-context-bar"><span>Step {workflowStep + 1} of 5</span><strong>{workflow[workflowStep]}</strong></div>
      )}
    </div>
  )
}
