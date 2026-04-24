'use client'
import { useState, useEffect, useMemo } from 'react'
import { TaskCard, ChallengeModal } from '@/components/tasks'
import { useWalletState } from '@/hooks/useWalletState'
import { cn } from '@/lib/data'
import type { Task, TaskStatus } from '@/types'

const INDEXER = 'http://localhost:8080'

const TABS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Pending',    value: 'pending' },
  { label: 'Executing',  value: 'executing' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Challenged', value: 'challenged' },
]

// Map indexer TaskEntity → frontend Task type
function mapTask(t: any): Task {
  return {
    id:          t.taskId ?? t.id ?? '',
    agentId:     t.agentId ?? '',
    agentName:   `Agent ${(t.agentId ?? '').slice(0, 8)}...`,
    assignedBy:  t.assignedBy ?? '',
    description: t.instruction ?? `Task ${(t.taskId ?? '').slice(0, 8)}...`,
    status:      (t.status ?? 'pending') as Task['status'],
    deadline:    t.deadline
      ? new Date(t.deadline * 1000).toLocaleString()
      : '—',
    completedAt: t.completedAt
      ? new Date(t.completedAt * 1000).toLocaleTimeString()
      : undefined,
    outputHash:    t.outputHash   ?? undefined,
    arweaveCid:    t.arweaveCid   ?? undefined,
    txSignatures:  t.attestationTx ? [t.attestationTx] : [],
    timestamp:     t.onChainCreatedAt
      ? new Date(t.onChainCreatedAt * 1000).toLocaleString()
      : '',
  }
}

async function loadTasksForAgent(agentId: string): Promise<Task[]> {
  const res = await fetch(`${INDEXER}/tasks/agent/${agentId}`)
  // 404 = no tasks yet — not an error
  if (res.status === 404) return []
  if (!res.ok) return []
  const data: any[] = await res.json()
  return Array.isArray(data) ? data.map(mapTask) : []
}

export default function TasksPage() {
  const { address, connected } = useWalletState()

  const [tab, setTab]               = useState<TaskStatus | 'all'>('all')
  const [tasks, setTasks]           = useState<Task[]>([])
  const [agentId, setAgentId]       = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [loading, setLoading]       = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [challenge, setChallenge]   = useState<Task | null>(null)

  //  Auto-load on wallet connect 
  useEffect(() => {
    if (!address) { setTasks([]); setAgentId(null); return }
    setLoading(true)

    fetch(`${INDEXER}/agents/operator/${address}`)
      .then(r => r.ok ? r.json() : [])
      .then(async (agents: any[]) => {
        if (!agents.length) { setLoading(false); return }
        const id = agents[0].agentId ?? agents[0].id
        setAgentId(id)
        const t = await loadTasksForAgent(id)
        setTasks(t)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [address])

  //  Load tasks for a specific agent ID 
  async function loadAgent(id?: string) {
    const targetId = (id ?? manualInput).trim()
    if (!targetId) return

    const isSwitch = !!agentId
    if (isSwitch) setSwitchLoading(true)
    else setLoading(true)

    try {
      const t = await loadTasksForAgent(targetId)
      setAgentId(targetId)
      setTasks(t)
      setManualInput('')
      setTab('all')
    } catch {}
    finally {
      setLoading(false)
      setSwitchLoading(false)
    }
  }

  //  Poll for updates every 5s when viewing pending tasks 
  useEffect(() => {
    if (!agentId) return
    const interval = setInterval(async () => {
      const t = await loadTasksForAgent(agentId)
      setTasks(t)
    }, 5000)
    return () => clearInterval(interval)
  }, [agentId])

  const filtered = useMemo(() =>
    tab === 'all' ? tasks : tasks.filter(t => t.status === tab),
    [tasks, tab])

  const counts = useMemo(() =>
    TABS.reduce((acc, t) => ({
      ...acc,
      [t.value]: t.value === 'all'
        ? tasks.length
        : tasks.filter(x => x.status === t.value).length,
    }), {} as Record<string, number>),
    [tasks])

  return (
    <div className="px-8 py-8 relative z-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Agent Work Queue</p>
          <h1 className="font-display text-4xl font-medium text-moss mb-1.5" style={{ letterSpacing: '-0.02em' }}>Task Panel</h1>
          <p className="text-[14px] text-muted">Monitor and challenge agent task execution</p>
        </div>
        <div className="flex items-center gap-0.5 mt-4 bg-stone border border-jade/25 rounded-sm p-1">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn('px-3.5 py-1.5 rounded-sm text-[12px] font-medium transition-all',
                tab === t.value ? 'bg-jadeDeep text-stone' : 'text-jadeMid hover:text-moss')}>
              {t.label}
              {counts[t.value] > 0 && (
                <span className={cn('ml-1.5 font-mono text-[10px]',
                  tab === t.value ? 'text-jade/60' : 'text-jade/50')}>
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Load agent bar ── */}
      <div className="stone-card p-4 mb-6 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1.5">
            Load agent tasks
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone border border-jade/25 rounded-sm px-3 py-2 font-mono
                text-[12px] text-ink placeholder:text-jade/50 outline-none
                focus:border-jadeDark transition-all"
              placeholder="Paste agent pubkey..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadAgent()}
            />
            <button
              onClick={() => loadAgent()}
              disabled={switchLoading || !manualInput.trim()}
              className="px-4 py-2 rounded-sm text-[12px] font-semibold bg-jade/15 border
                border-jade/35 text-jadeDark hover:bg-jade/25 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {switchLoading ? 'Loading...' : 'Load →'}
            </button>
          </div>
        </div>
        {agentId && (
          <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
            <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">Viewing</div>
            <div className="font-mono text-[12px] text-jadeDark">{agentId.slice(0, 8)}...</div>
            <div className="font-mono text-[10px] text-jade mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {/* live indicator — polling every 5s */}
              <span className="ml-2 text-success">● live</span>
            </div>
          </div>
        )}
        {!agentId && !connected && (
          <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
            <div className="font-mono text-[10px] text-jadeMid">Connect wallet or</div>
            <div className="font-mono text-[10px] text-jadeMid">paste agent ID above</div>
          </div>
        )}
      </div>

      {/* ── Task list ── */}
      {loading ? (
        <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
          Loading tasks...
        </div>
      ) : !agentId ? (
        <div className="stone-card p-10 text-center">
          <div className="font-display text-lg text-moss mb-2">No agent loaded</div>
          <p className="text-[13px] text-muted">
            {connected
              ? 'Paste an agent pubkey above to view its tasks.'
              : 'Connect your wallet or paste an agent pubkey above.'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="font-mono text-[13px] text-jadeMid py-12 text-center">
          {tab === 'all' ? 'No tasks found for this agent' : `No ${tab} tasks`}
        </div>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {filtered.map(t => (
            <div key={t.id} className="animate-fade-up">
              <TaskCard task={t} onChallenge={setChallenge} />
            </div>
          ))}
        </div>
      )}

      {challenge && <ChallengeModal task={challenge} onClose={() => setChallenge(null)} />}
    </div>
  )
}