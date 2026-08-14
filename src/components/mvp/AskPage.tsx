import {
  BookOpenCheck,
  Check,
  ChevronDown,
  Copy,
  Focus,
  History,
  LoaderCircle,
  MessageCircleQuestion,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { automaticThreadTitle, citationIndexFromHref, createChatThread, productContextFromLog } from '../../domain/chat'
import type { ChatMessage, ChatProductContext, ChatStreamEvent, ChatThread, LogEntry } from '../../domain/types'
import { streamChat } from '../../lib/api'
import {
  deleteAllChatThreads,
  deleteChatThread,
  listChatThreads,
  listLogs,
  saveChatThread,
} from '../../lib/db'

interface Props {
  onFocusModeChange?: (focused: boolean) => void
  onComposerFocusChange?: (focused: boolean) => void
}

const GENERAL_SUGGESTIONS = [
  'What is the difference between total sugars and added sugars?',
  'How should I compare serving sizes on two nutrition labels?',
  'What can a glycemic index value tell me—and what can’t it tell me?',
  'What does the evidence say about walking after a meal?',
]

const PRODUCT_SUGGESTIONS = [
  'What does this validated label say about its sugars?',
  'Which values were not declared or unavailable on this label?',
  'How does the serving size affect how I read these numbers?',
  'What can—and can’t—the ingredient list tell me about sweeteners?',
]

function uid(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function displayValue(value: number | null): string {
  return value == null ? 'Not declared / unavailable' : `${value} g`
}

export default function AskPage({ onFocusModeChange, onComposerFocusChange }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [products, setProducts] = useState<Array<{ entry: LogEntry; context: ChatProductContext }>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [stage, setStage] = useState('')
  const [activeSource, setActiveSource] = useState<number | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [threadsOpen, setThreadsOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    void Promise.all([listChatThreads(), listLogs()]).then(([storedThreads, logs]) => {
      if (!active) return
      const contexts = logs.flatMap((entry) => {
        const context = productContextFromLog(entry)
        return context ? [{ entry, context }] : []
      })
      let initial = storedThreads
      if (initial.length === 0) initial = [createChatThread()]
      setThreads(initial)
      setSelectedId(initial[0].id)
      setProducts(contexts)
      setLoading(false)
      if (storedThreads.length === 0) void saveChatThread(initial[0])
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--sugar-pai-keyboard-offset', `${offset}px`)
    }
    updateKeyboardOffset()
    viewport.addEventListener('resize', updateKeyboardOffset)
    viewport.addEventListener('scroll', updateKeyboardOffset)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset)
      viewport.removeEventListener('scroll', updateKeyboardOffset)
      document.documentElement.style.removeProperty('--sugar-pai-keyboard-offset')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: streaming ? 'smooth' : 'auto' })
  }, [streaming, threads])

  const current = threads.find((thread) => thread.id === selectedId) ?? null
  const latestAssistant = [...(current?.messages ?? [])].reverse().find((message) => message.role === 'assistant')
  const visibleSources = latestAssistant?.sources ?? []

  const persist = async (thread: ChatThread) => {
    setThreads((existing) => [thread, ...existing.filter((item) => item.id !== thread.id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    setSelectedId(thread.id)
    await saveChatThread(thread)
  }

  const newThread = (context: ChatProductContext | null = current?.context ?? null) => {
    if (streaming) abortRef.current?.abort()
    const next = createChatThread(context)
    void persist(next)
    setDraft('')
    setStage('')
    setActiveSource(null)
    setThreadsOpen(false)
  }

  const selectContext = (localLogId: string) => {
    if (!current || streaming) return
    const context = products.find((product) => product.context.localLogId === localLogId)?.context ?? null
    void persist({ ...current, context, updatedAt: new Date().toISOString() })
  }

  const updateAssistant = (
    base: ChatThread,
    assistantId: string,
    update: (message: ChatMessage) => ChatMessage,
  ): ChatThread => ({
    ...base,
    updatedAt: new Date().toISOString(),
    messages: base.messages.map((message) => message.id === assistantId ? update(message) : message),
  })

  const runQuestion = async (base: ChatThread, question: string) => {
    const askedAt = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: uid('user'), role: 'user', content: question, createdAt: askedAt, sources: [], warnings: [], state: 'complete',
    }
    const assistantId = uid('assistant')
    const assistant: ChatMessage = {
      id: assistantId, role: 'assistant', content: '', createdAt: askedAt, sources: [], warnings: [], state: 'streaming',
    }
    let working: ChatThread = {
      ...base,
      title: base.messages.length === 0 ? automaticThreadTitle(question) : base.title,
      updatedAt: askedAt,
      messages: [...base.messages, userMessage, assistant],
    }
    await persist(working)
    setDraft('')
    setStreaming(true)
    setStage('Checking evidence…')
    setActionMessage(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamChat({
        question,
        turns: base.messages.slice(-10).map(({ role, content }) => ({ role, content })),
        ...(base.context ? { product: base.context } : {}),
      }, (event: ChatStreamEvent) => {
        if (event.type === 'stage') setStage(event.label)
        if (event.type === 'sources') {
          working = updateAssistant(working, assistantId, (message) => ({ ...message, sources: event.sources, warnings: event.warnings }))
          setEvidenceOpen(event.sources.length > 0 && window.matchMedia('(max-width: 900px)').matches)
        }
        if (event.type === 'delta') {
          working = updateAssistant(working, assistantId, (message) => ({ ...message, content: message.content + event.text }))
        }
        if (event.type === 'error') {
          working = updateAssistant(working, assistantId, (message) => ({
            ...message, state: 'error', error: { code: event.code, message: event.message, retryable: event.retryable },
          }))
        }
        if (event.type === 'done') {
          working = updateAssistant(working, assistantId, (message) => ({ ...message, state: 'complete' }))
        }
        void persist(working)
      }, controller.signal)
    } catch (caught) {
      const cancelled = caught instanceof DOMException && caught.name === 'AbortError'
      working = updateAssistant(working, assistantId, (message) => ({
        ...message,
        state: cancelled ? 'cancelled' : 'error',
        error: cancelled ? undefined : { code: 'network_error', message: 'The chat connection was interrupted. Your question is saved locally.', retryable: true },
      }))
      await persist(working)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setStreaming(false)
      setStage('')
    }
  }

  const submit = () => {
    const question = draft.trim()
    if (!current || !question || question.length > 2_000 || streaming) return
    void runQuestion(current, question)
    onComposerFocusChange?.(false)
  }

  const retryLast = () => {
    if (!current || streaming) return
    let lastUserIndex = -1
    for (let index = current.messages.length - 1; index >= 0; index -= 1) {
      if (current.messages[index].role === 'user') {
        lastUserIndex = index
        break
      }
    }
    if (lastUserIndex < 0) return
    const question = current.messages[lastUserIndex].content
    const base = { ...current, messages: current.messages.slice(0, lastUserIndex) }
    void runQuestion(base, question)
  }

  const activateSource = (index: number) => {
    setActiveSource(index)
    setEvidenceOpen(true)
    window.setTimeout(() => document.getElementById(`source-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20)
    window.setTimeout(() => setActiveSource((active) => active === index ? null : active), 2200)
  }

  const setFocused = (next: boolean) => {
    setFocusMode(next)
    onFocusModeChange?.(next)
  }

  const removeCurrent = async () => {
    if (!current || !window.confirm(`Delete “${current.title}”? This cannot be undone.`)) return
    abortRef.current?.abort()
    await deleteChatThread(current.id)
    const remaining = threads.filter((thread) => thread.id !== current.id)
    if (remaining.length) {
      setThreads(remaining)
      setSelectedId(remaining[0].id)
    } else {
      const next = createChatThread()
      setThreads([next])
      setSelectedId(next.id)
      await saveChatThread(next)
    }
  }

  const clearThreads = async () => {
    if (!window.confirm('Delete every local evidence-chat thread? This cannot be undone.')) return
    abortRef.current?.abort()
    await deleteAllChatThreads()
    const next = createChatThread()
    setThreads([next])
    setSelectedId(next.id)
    await saveChatThread(next)
  }

  const suggestions = current?.context ? PRODUCT_SUGGESTIONS : GENERAL_SUGGESTIONS

  if (loading || !current) {
    return <div className="page ask-page ask-loading"><LoaderCircle className="spin" /><span>Opening local conversations…</span></div>
  }

  return (
    <div className={`ask-workspace ${focusMode ? 'focus-mode' : ''}`}>
      <header className="ask-toolbar">
        <div className="thread-picker-wrap">
          <button className="thread-picker" type="button" onClick={() => setThreadsOpen((open) => !open)} aria-expanded={threadsOpen}>
            <History size={17} /><span>{current.title}</span><ChevronDown size={15} />
          </button>
          {threadsOpen && (
            <div className="thread-menu">
              <div className="thread-menu-heading"><strong>Local conversations</strong><button onClick={() => setThreadsOpen(false)} aria-label="Close conversations"><X size={17} /></button></div>
              {threads.map((thread) => (
                <button key={thread.id} className={thread.id === current.id ? 'active' : ''} onClick={() => { setSelectedId(thread.id); setThreadsOpen(false) }}>
                  <span>{thread.title}</span><small>{new Date(thread.updatedAt).toLocaleDateString()}</small>
                </button>
              ))}
              <button className="thread-new" onClick={() => newThread()}><Plus size={16} /> New conversation</button>
              <button className="thread-clear" onClick={() => void clearThreads()}><Trash2 size={15} /> Clear all local chats</button>
            </div>
          )}
        </div>
        <div className="ask-toolbar-actions">
          <button type="button" onClick={() => setEditingTitle((editing) => !editing)} aria-label="Rename conversation"><Pencil size={16} /></button>
          <button type="button" onClick={() => newThread()} aria-label="New conversation"><Plus size={18} /></button>
          <button type="button" onClick={() => setFocused(!focusMode)} aria-pressed={focusMode} aria-label="Toggle focus mode">{focusMode ? <PanelRightOpen size={17} /> : <Focus size={17} />}</button>
          <button type="button" onClick={() => void removeCurrent()} aria-label="Delete conversation"><Trash2 size={16} /></button>
        </div>
      </header>

      {editingTitle && (
        <form className="rename-thread" onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const title = String(data.get('title') ?? '').trim()
          if (title) void persist({ ...current, title: title.slice(0, 80), updatedAt: new Date().toISOString() })
          setEditingTitle(false)
        }}>
          <label><span>Conversation title</span><input name="title" defaultValue={current.title} maxLength={80} autoFocus /></label>
          <button className="primary-button" type="submit"><Check size={16} /> Save</button>
        </form>
      )}

      <div className="chat-context-bar">
        <label>
          <span>Answer context</span>
          <select value={current.context?.localLogId ?? ''} disabled={streaming} onChange={(event) => selectContext(event.target.value)}>
            <option value="">General evidence</option>
            {products.map(({ entry, context }) => (
              <option key={entry.id} value={entry.id}>{context.productName} · {new Date(entry.loggedAt).toLocaleDateString()}</option>
            ))}
          </select>
        </label>
        {current.context ? (
          <div className="context-chip"><BookOpenCheck size={16} /><span><strong>{current.context.productName}</strong><small>Validated local record · {current.context.servingLabel ?? 'Serving unavailable'}</small></span></div>
        ) : (
          <div className="context-chip general"><Sparkles size={16} /><span><strong>Curated evidence</strong><small>No product data is attached</small></span></div>
        )}
      </div>

      <div className="chat-layout">
        <main className="chat-column">
          {current.messages.length === 0 ? (
            <section className="chat-empty">
              <span className="ask-orb"><MessageCircleQuestion size={28} /></span>
              <h1>Ask the evidence.</h1>
              <p>{current.context ? `Questions will use the validated label for ${current.context.productName} plus relevant curated sources.` : 'Ask within Sugar pAI’s curated topics. Answers stay tied to the sources shown beside them.'}</p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setDraft(suggestion); textareaRef.current?.focus() }}>{suggestion}<Send size={14} /></button>)}
              </div>
            </section>
          ) : (
            <div className="message-list" aria-live="polite">
              {current.messages.map((message) => (
                <article key={message.id} className={`chat-message message-${message.role} state-${message.state}`}>
                  <div className="message-label">{message.role === 'user' ? 'You' : 'Sugar pAI'}{message.state === 'streaming' && <LoaderCircle className="spin" size={14} />}</div>
                  {message.role === 'assistant' ? (
                    <div className="markdown-answer">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => {
                            const index = citationIndexFromHref(href)
                            return index ? (
                              <button
                                type="button"
                                className={`citation-link ${activeSource === index ? 'active' : ''}`}
                                onClick={() => activateSource(index)}
                                onMouseEnter={() => setActiveSource(index)}
                                onMouseLeave={() => setActiveSource(null)}
                              >{children}</button>
                            ) : <a href={href} target="_blank" rel="noreferrer">{children}</a>
                          },
                        }}
                      >{message.content || (message.state === 'streaming' ? 'Reviewing the selected evidence…' : '')}</ReactMarkdown>
                    </div>
                  ) : <p>{message.content}</p>}
                  {message.warnings.map((warning) => <div className="retrieval-warning" key={warning}>{warning}</div>)}
                  {message.error && <div className="message-error"><strong>{message.error.message}</strong>{message.error.retryable && <button onClick={retryLast}><RefreshCw size={14} /> Retry</button>}</div>}
                  {message.state === 'cancelled' && <div className="message-error"><span>Generation stopped. The partial answer is preserved.</span><button onClick={retryLast}><RefreshCw size={14} /> Retry</button></div>}
                  {message.role === 'assistant' && message.state !== 'streaming' && (
                    <div className="message-actions">
                      <button onClick={() => { void navigator.clipboard.writeText(message.content); setActionMessage('Answer copied') }}><Copy size={14} /> Copy</button>
                      {message.sources.length > 0 && <button onClick={() => setEvidenceOpen(true)}><BookOpenCheck size={14} /> {message.sources.length} sources</button>}
                      <button onClick={retryLast}><RefreshCw size={14} /> Regenerate</button>
                      <button aria-label="More answer actions"><MoreHorizontal size={16} /></button>
                    </div>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="composer-dock">
            {stage && <div className="chat-stage"><LoaderCircle className="spin" size={14} />{stage}</div>}
            {actionMessage && <div className="chat-stage success">{actionMessage}</div>}
            <div className="chat-composer">
              <textarea
                ref={textareaRef}
                value={draft}
                rows={1}
                maxLength={2_000}
                placeholder={current.context ? `Ask about ${current.context.productName}…` : 'Ask an evidence question…'}
                onChange={(event) => {
                  setDraft(event.target.value)
                  event.target.style.height = 'auto'
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 132)}px`
                }}
                onFocus={() => onComposerFocusChange?.(true)}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget
                  if (!(nextTarget instanceof Node && event.currentTarget.parentElement?.contains(nextTarget))) {
                    onComposerFocusChange?.(false)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
              />
              {streaming ? (
                <button className="stop-button" onClick={() => abortRef.current?.abort()} aria-label="Stop response"><Square size={17} /></button>
              ) : (
                <button className="send-button" disabled={!draft.trim()} onClick={submit} aria-label="Send question"><Send size={18} /></button>
              )}
            </div>
            <small>{draft.length}/2,000 · Educational evidence, not medical advice</small>
          </div>
        </main>

        {!focusMode && (
          <EvidenceRail
            sources={visibleSources}
            context={current.context}
            activeSource={activeSource}
            onHover={setActiveSource}
            open={evidenceOpen}
            onClose={() => setEvidenceOpen(false)}
          />
        )}
      </div>

      {!focusMode && visibleSources.length > 0 && (
        <button className="mobile-evidence-button" onClick={() => setEvidenceOpen(true)}><PanelRightOpen size={18} /> Evidence <span>{visibleSources.length}</span></button>
      )}
    </div>
  )
}

function EvidenceRail({
  sources,
  context,
  activeSource,
  onHover,
  open,
  onClose,
}: {
  sources: ChatMessage['sources']
  context: ChatProductContext | null
  activeSource: number | null
  onHover: (index: number | null) => void
  open: boolean
  onClose: () => void
}) {
  return (
    <aside className={`evidence-rail ${open ? 'open' : ''}`} aria-label="Answer evidence">
      <div className="evidence-rail-heading">
        <div><span className="section-kicker">Evidence</span><strong>{sources.length ? `${sources.length} sources` : 'Waiting for a question'}</strong></div>
        <button onClick={onClose} aria-label="Close evidence"><PanelRightClose size={18} /></button>
      </div>
      {context && (
        <div className="product-evidence-summary">
          <span>Selected label</span>
          <strong>{context.productName}</strong>
          <dl>
            <div><dt>Total sugars</dt><dd>{displayValue(context.nutrients.totalSugars)}</dd></div>
            <div><dt>Added sugars</dt><dd>{displayValue(context.nutrients.addedSugars)}</dd></div>
            <div><dt>Fiber</dt><dd>{displayValue(context.nutrients.fiber)}</dd></div>
          </dl>
        </div>
      )}
      <div className="source-list">
        {sources.map((source) => (
          <article
            id={`source-${source.index}`}
            key={source.id}
            className={`source-item ${activeSource === source.index ? 'active' : ''}`}
            onMouseEnter={() => onHover(source.index)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="source-number">{source.index}</div>
            <div>
              <div className="source-meta"><span>{source.type}</span><span>{source.strength}</span></div>
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <strong>{source.title}</strong>}
              <small>{source.publisher} · {source.relationship}</small>
              <p>{source.excerpt}</p>
            </div>
          </article>
        ))}
        {!sources.length && <div className="evidence-empty"><BookOpenCheck size={22} /><p>Sources appear here before the answer begins.</p></div>}
      </div>
      <button className="evidence-sheet-close" onClick={onClose}><X size={17} /> Close evidence</button>
    </aside>
  )
}
