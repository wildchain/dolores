'use client'
import { useState, useEffect } from 'react'
import { Card, CardLabel, Button, StatTile, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { useWalletState } from '@/hooks/useWalletState'
import { MOCK_REP } from '@/lib/data'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const INDEXER = 'http://localhost:8080'

const CAPABILITY_HASH_LABELS: Record<string, string> = {}
function capHashToLabel(hash: string): string {
  if (!hash) return '—'
  return CAPABILITY_HASH_LABELS[hash] ?? `${hash.slice(0, 8)}...${hash.slice(-8)}`
}

function getTier(reputation: number, slashCount: number): { label: string; cls: string } {
  if (slashCount >= 3) return { label: 'Banned', cls: 'text-danger' }
  if (reputation >= 8500) return { label: 'Exemplary', cls: 'text-success' }
  if (reputation >= 6500) return { label: 'Established', cls: 'text-success' }
  if (reputation >= 4000) return { label: 'Developing', cls: 'text-jadeDark' }
  if (reputation >= 1500) return { label: 'Provisional', cls: 'text-amber' }
  return { label: 'Unverified', cls: 'text-amber' }
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-stone border border-jade/30 rounded-sm px-3 py-2 text-[12px] font-mono"
      style={{ boxShadow: '0 2px 8px rgba(36,40,32,0.12)' }}>
      <div className="text-jadeMid mb-0.5">{label}</div>
      <div className="text-moss font-semibold">{payload[0].value.toFixed(0)}</div>
    </div>
  )
}

async function fetchAgentData(id: string) {
  const [agentData, receiptsData, fundData] = await Promise.all([
    fetch(`${INDEXER}/agents/${id}`).then(r => r.ok ? r.json() : null),
    fetch(`${INDEXER}/receipts/agent/${id}`).then(r => r.ok ? r.json() : []),
    fetch(`${INDEXER}/fund/${id}`).then(r => r.ok ? r.json() : null),
  ])
  return { agentData, receiptsData, fundData }
}

export default function DashboardPage() {
  const { toast } = useToast()
  const { address, connected } = useWalletState()

  const [agentId, setAgentId] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [agent, setAgent] = useState<any>(null)
  const [receipts, setReceipts] = useState<any[]>([])
  const [fund, setFund] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [noAgentFound, setNoAgentFound] = useState(false)

  // ── Auto-load on wallet connect ────────────────────────────
  useEffect(() => {
    if (!address) {
      setAgentId(null); setAgent(null)
      setReceipts([]); setFund(null)
      setNoAgentFound(false)
      return
    }
    setLoading(true)
    setNoAgentFound(false)

    fetch(`${INDEXER}/agents/operator/${address}`)
      .then(r => r.ok ? r.json() : [])
      .then(async (agents: any[]) => {
        if (!agents.length) { setNoAgentFound(true); setLoading(false); return }
        const id = agents[0].agentId ?? agents[0].id
        setAgentId(id)
        const { agentData, receiptsData, fundData } = await fetchAgentData(id)
        setAgent(agentData)
        setReceipts(Array.isArray(receiptsData) ? receiptsData : [])
        setFund(fundData)
      })
      .catch(() => setNoAgentFound(true))
      .finally(() => setLoading(false))
  }, [address])

  // ── Load agent by ID (first load or switch) ────────────────
  async function loadAgent(id?: string) {
    const targetId = (id ?? manualInput).trim()
    if (!targetId) { toast('Paste an agent pubkey', 'error'); return }

    const isSwitch = !!agent  // already viewing an agent → this is a switch
    if (isSwitch) setSwitchLoading(true)
    else setLoading(true)

    try {
      const { agentData, receiptsData, fundData } = await fetchAgentData(targetId)
      if (!agentData) {
        toast('Agent not found — check the pubkey', 'error'); return
      }
      setAgentId(targetId)
      setAgent(agentData)
      setReceipts(Array.isArray(receiptsData) ? receiptsData : [])
      setFund(fundData)
      setNoAgentFound(false)
      setManualInput('')
    } catch {
      toast('Could not reach indexer', 'error')
    } finally {
      setLoading(false)
      setSwitchLoading(false)
    }
  }

  // ── Not connected ──────────────────────────────────────────
  if (!connected) {
    return (
      <div className="px-8 py-8 relative z-10">
        <div className="mb-7">
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Operator</p>
          <h1 className="font-display text-4xl font-medium text-moss mb-1.5" style={{ letterSpacing: '-0.02em' }}>Dashboard</h1>
        </div>
        <div className="stone-card p-12 text-center max-w-md mx-auto">
          <div className="font-display text-xl text-moss mb-2">Connect your wallet</div>
          <p className="text-[13px] text-muted">Connect your operator wallet to see your agent dashboard.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="px-8 py-8 font-mono text-[13px] text-jadeMid">Loading agent data...</div>
  }

  // ── No agent found — initial lookup input ──────────────────
  if (noAgentFound || (!agent && connected)) {
    return (
      <div className="px-8 py-8 relative z-10">
        <div className="mb-7">
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Operator</p>
          <h1 className="font-display text-4xl font-medium text-moss mb-1.5" style={{ letterSpacing: '-0.02em' }}>Dashboard</h1>
        </div>
        <div className="stone-card p-8 max-w-md mx-auto">
          <div className="font-display text-xl text-moss mb-1.5">Find your agent</div>
          <p className="text-[13px] text-muted mb-6">
            Paste your agent pubkey from{' '}
            <span className="font-mono text-jadeDark">dolores register</span> output.
          </p>
          <div className="bg-jade/8 border border-jade/20 rounded-sm p-3 mb-4 font-mono text-[11px]">
            <span className="text-jadeMid">Operator wallet: </span>
            <span className="text-jadeDark">{address}</span>
          </div>
          <Input
            label="Agent pubkey"
            placeholder="e.g. 9HV6oz8jWhWcArhA4Upv..."
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadAgent()}
          />
          <Button className="w-full" onClick={() => loadAgent()}>Load Agent →</Button>
          <div className="mt-5 pt-5 border-t border-jade/15">
            <p className="text-[12px] text-muted mb-3">Don't have an agent yet?</p>
            <Button variant="secondary" className="w-full"
              onClick={() => window.location.href = '/register'}>
              Register Agent →
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main dashboard ─────────────────────────────────────────
  const reputation = agent.reputationScore ?? 0
  const slashCount = agent.slashCount ?? 0
  const declaredStake = agent.declaredStake ?? 0
  const capHash = agent.capabilityHash ?? ''
  const totalTasks = receipts.length
  const recentTasks = receipts.slice(-3).reverse()
  const tier = getTier(reputation, slashCount)

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="mb-6">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Operator</p>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl font-medium text-moss mb-1" style={{ letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p className="text-[14px] text-muted">Manage your agent, stake, and reputation</p>
          </div>
        </div>
      </div>

      {/* ── Load another agent ─────────────────────────────── */}
      <div className="stone-card p-4 mb-6 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1.5">
            Load another agent
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone border border-jade/25 rounded-sm px-3 py-2 font-mono text-[12px]
                text-ink placeholder:text-jade/50 outline-none focus:border-jadeDark transition-all"
              placeholder="Paste agent pubkey..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadAgent()}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => loadAgent()}
              disabled={switchLoading || !manualInput.trim()}
              className="flex-shrink-0"
            >
              {switchLoading ? 'Loading...' : 'Load →'}
            </Button>
          </div>
        </div>
        {/* Currently viewing */}
        <div className="flex-shrink-0 text-right border-l border-jade/15 pl-4">
          <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">Viewing</div>
          <div className="font-mono text-[12px] text-jadeDark">{(agentId ?? '').slice(0, 8)}...</div>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '280px 1fr' }}>

        {/* ── Sidebar ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="text-center">
              <div className="w-16 h-16 rounded-sm mx-auto mb-3 flex items-center justify-center
                font-display text-2xl font-medium text-moss bg-jade/20 border border-jade/30">
                {(agentId ?? '??').slice(0, 2).toUpperCase()}
              </div>
              <div className="font-display text-[18px] font-medium text-moss mb-1">
                Agent {(agentId ?? '').slice(0, 8)}...
              </div>
              <div className="font-mono text-[10px] text-jade mb-4">
                {(agentId ?? '').slice(0, 20)}...
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span className="text-muted">Reputation</span>
                  <span className="font-mono font-semibold text-jadeDark">{reputation} / 10000</span>
                </div>
                <div className="h-1.5 bg-jade/20 rounded-sm overflow-hidden">
                  <div className="h-full bg-jadeDark rounded-sm transition-all duration-700"
                    style={{ width: `${(reputation / 10000) * 100}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Tasks" value={String(totalTasks)} />
                <StatTile label="Slashes" value={String(slashCount)}
                  valueClass={slashCount === 0 ? 'text-success' : 'text-danger'} />
                <StatTile label="Operator" value={(address ?? '').slice(0, 6) + '...'} />
                <StatTile label="Tier" value={tier.label} valueClass={tier.cls} />
              </div>
            </div>
          </Card>

          <Card>
            <CardLabel>Fund Pool</CardLabel>
            <div className="space-y-2.5 mb-4">
              {[
                { k: 'Declared stake', v: `${(declaredStake / 1e9).toFixed(4)} SOL`, cls: 'text-jadeDeep font-semibold' },
                { k: 'Validator stake', v: fund ? `${(fund.validatorStake / 1e9).toFixed(4)} SOL` : '—', cls: 'text-moss' },
                { k: 'Community stake', v: fund ? `${(fund.communityStake / 1e9).toFixed(4)} SOL` : '—', cls: 'text-moss' },
                { k: 'Total locked', v: fund ? `${(fund.totalLockedStake / 1e9).toFixed(4)} SOL` : '—', cls: 'text-moss font-bold' },
                {
                  k: 'Challenge active', v: fund?.challengeActive ? 'Yes' : 'No',
                  cls: fund?.challengeActive ? 'text-danger' : 'text-success'
                },
              ].map(r => (
                <div key={r.k} className="flex justify-between py-2 text-[13px] border-b border-jade/15 last:border-0">
                  <span className="text-muted">{r.k}</span>
                  <span className={`font-mono ${r.cls}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => toast('Claim coming soon')}>Claim</Button>
              <Button variant="secondary" size="sm" className="flex-1"
                onClick={() => { setAgent(null); setNoAgentFound(true) }}>
                Change Agent
              </Button>
            </div>
          </Card>

          <Card>
            <CardLabel>Capabilities</CardLabel>
            <div className="font-mono text-[13px] text-jadeDark font-medium mb-2">
              {capHashToLabel(capHash)}
            </div>
            <div className="font-mono text-[10px] text-jade break-all">{capHash || '—'}</div>
          </Card>
        </div>

        {/* ── Main column ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardLabel>Reputation History</CardLabel>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_REP} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B7A5C" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6B7A5C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#8A9678', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={false} tickLine={false} interval={3} />
                  <YAxis domain={[0, 10000]} tick={{ fill: '#8A9678', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="score" stroke="#6B7A5C" strokeWidth={2}
                    fill="url(#rg)" dot={false} activeDot={{ r: 4, fill: '#4A5640', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardLabel>Recent Tasks</CardLabel>
            {recentTasks.length === 0 ? (
              <div className="font-mono text-[12px] text-jadeMid py-4 text-center">No tasks yet</div>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((t: any) => (
                  <div key={t.taskId}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-jade/8 border border-jade/15 rounded-sm">
                    <div>
                      <div className="font-display text-[14px] text-moss">
                        SOL transfer · {t.outputHash?.slice(0, 8)}...
                      </div>
                      <div className="font-mono text-[10px] text-jade mt-0.5">
                        {t.taskId?.slice(0, 16)} · {t.attested ? 'attested' : 'pending'}
                      </div>
                    </div>
                    <span className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm border
                      ${t.attested
                        ? 'text-success bg-success/10 border-success/25'
                        : 'text-jadeDark bg-jade/15 border-jade/30'}`}>
                      {t.attested ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardLabel>Permanent Record — Arweave</CardLabel>
            <div className="flex items-center gap-3 bg-jade/8 border border-jade/15 rounded-sm p-3.5 mb-3">
              <div className="font-mono text-[11px] text-jadeMid flex-1 truncate">
                cid: <span className="text-jadeDark">{agent.arweaveCid || 'none yet'}</span>
              </div>
              {agent.arweaveCid && (
                <Button variant="ghost" size="sm" className="text-[11px] flex-shrink-0"
                  onClick={() => window.open(`https://arweave.net/${agent.arweaveCid}`, '_blank')}>
                  View ↗
                </Button>
              )}
            </div>
            <p className="text-[12px] text-muted">{totalTasks} task receipts on record.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}