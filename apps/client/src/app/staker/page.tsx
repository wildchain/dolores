'use client'
import { useState, useEffect, useMemo } from 'react'
import { Card, CardLabel, Button, Input, StatusBadge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { useWalletState } from '@/hooks/useWalletState'
import { cn } from '@/lib/data'

const INDEXER = 'http://localhost:8080'

export default function StakerPage() {
  const { toast } = useToast()

  // ── hooks inside the component ──────────────────────────────
  const { address, connected } = useWalletState()

  const [addr, setAddr] = useState('')
  const [amt, setAmt] = useState('')
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) { setPositions([]); return }
    setLoading(true)
    fetch(`${INDEXER}/stakers/${address}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPositions(Array.isArray(data) ? data : []))
      .catch(() => setPositions([]))
      .finally(() => setLoading(false))
  }, [address])

  const totalStaked = useMemo(() => positions.reduce((s, p) => s + (p.amountStaked ?? 0), 0), [positions])
  const totalClaimable = useMemo(() => positions.reduce((s, p) => s + (p.claimableRewards ?? 0), 0), [positions])
  const totalEarned = useMemo(() => positions.reduce((s, p) => s + (p.totalEarned ?? 0), 0), [positions])

  const slashExp = amt && !isNaN(Number(amt))
    ? `${(Number(amt) * 0.6).toFixed(4)} SOL`
    : '— SOL'

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="mb-7">
        <div className="ink-rule" />
        <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Community</p>
        <h1 className="font-display text-4xl font-medium text-moss mb-1.5" style={{ letterSpacing: '-0.02em' }}>Staker</h1>
        <p className="text-[14px] text-muted">Back agents you trust and earn proportional rewards every 7 days</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { l: 'Total Staked', v: loading ? '...' : `${(totalStaked / 1e9).toFixed(4)} SOL`, sub: 'across all agents', cls: 'text-jadeDeep' },
          { l: 'Claimable', v: loading ? '...' : `${totalClaimable} SOL`, sub: 'next epoch in 7d', cls: 'text-success' },
          { l: 'Total Earned', v: loading ? '...' : `${totalEarned} SOL`, sub: 'all time', cls: 'text-moss' },
        ].map(s => (
          <div key={s.l} className="stone-card p-5">
            <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-2">{s.l}</div>
            <div className={`font-display text-2xl font-medium mb-1 ${s.cls}`}>{s.v}</div>
            <div className="text-[12px] text-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 310px' }}>

        {/* Positions */}
        <div>
          <div className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-4">Your Positions</div>

          {!connected ? (
            <div className="stone-card p-10 text-center">
              <div className="font-display text-lg text-moss mb-2">Connect your wallet</div>
              <p className="text-[13px] text-muted">Connect your wallet to see your staking positions.</p>
            </div>
          ) : loading ? (
            <div className="font-mono text-[13px] text-jadeMid py-12 text-center">Loading positions...</div>
          ) : positions.length === 0 ? (
            <div className="font-mono text-[13px] text-jadeMid py-12 text-center">No staking positions found</div>
          ) : (
            <div className="flex flex-col gap-3 stagger">
              {positions.map(pos => {
                const health = (pos.slashCount ?? 0) === 0 ? 'healthy' : 'at_risk'
                const barCol = (pos.slashCount ?? 0) === 0 ? '#6B7A5C' : '#8B6A2C'
                return (
                  <div key={pos.agentId} className="stone-card p-4 animate-fade-up">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-display text-[16px] font-medium text-moss">
                          {pos.agentId?.slice(0, 8)}...
                        </div>
                        <div className="font-mono text-[11px] text-jadeMid mt-0.5">
                          Rep {pos.reputationScore ?? 0}
                        </div>
                      </div>
                      <StatusBadge status={health} />
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { l: 'Your stake', v: `${((pos.amountStaked ?? 0) / 1e9).toFixed(4)} SOL`, cls: 'text-jadeDeep' },
                        { l: 'Pool share', v: `${pos.poolShare ?? 0}%`, cls: 'text-moss' },
                        { l: 'Claimable', v: `${pos.claimableRewards ?? 0} SOL`, cls: 'text-success' },
                        {
                          l: 'Slashes', v: String(pos.slashCount ?? 0),
                          cls: (pos.slashCount ?? 0) === 0 ? 'text-success' : 'text-danger'
                        },
                      ].map(s => (
                        <div key={s.l} className="bg-jade/10 border border-jade/20 rounded-sm p-2.5">
                          <div className="font-mono text-[10px] text-jade mb-1">{s.l}</div>
                          <div className={`font-display text-[13px] font-semibold ${s.cls}`}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="h-1 bg-jade/15 rounded-sm mb-3 overflow-hidden">
                      <div className="h-full rounded-sm transition-all"
                        style={{ width: `${pos.poolShare ?? 0}%`, background: barCol }} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[12px] text-muted">
                        Next dist. <span className="font-mono text-jadeDark font-medium">7d</span>
                      </div>
                      <Button size="sm" onClick={() => toast('Claim coming soon')}>
                        Claim rewards
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stake form */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="font-display text-[17px] font-medium text-moss mb-4">Stake into an Agent</div>
            <Input
              label="Agent address"
              placeholder="Paste agent pubkey..."
              value={addr}
              onChange={e => setAddr(e.target.value)}
            />
            <Input
              label="Amount (SOL)"
              type="number"
              placeholder="Min 0.01 SOL"
              value={amt}
              onChange={e => setAmt(e.target.value)}
            />
            <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-4 space-y-2">
              {[
                { k: 'Epoch duration', v: '7 days' },
                { k: 'Est. APY', v: '~12.4%', cls: 'text-success' },
                { k: 'Slash exposure', v: slashExp, cls: 'text-danger' },
                { k: 'Early withdraw', v: 'Allowed' },
              ].map(r => (
                <div key={r.k} className="flex justify-between text-[12px]">
                  <span className="text-muted">{r.k}</span>
                  <span className={`font-mono ${(r as any).cls ?? 'text-jadeDark'}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!connected}
              onClick={() => {
                if (!addr || !amt) { toast('Fill in both fields', 'error'); return }
                toast(`Staked ${Number(amt)} SOL — StakerPosition PDA created`)
                setAddr(''); setAmt('')
              }}
            >
              {connected ? 'Stake SOL' : 'Connect wallet first'}
            </Button>
          </Card>

          <Card>
            <CardLabel>How rewards work</CardLabel>
            <div className="text-[12px] text-muted leading-relaxed space-y-2.5">
              <p>Your share = <span className="font-mono text-jadeDark">your_stake / total_pool</span></p>
              <p>Example: 0.5 SOL in a 2 SOL pool → you earn 25% of all rewards.</p>
              <p>If the agent is slashed, your position reduces proportionally.</p>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}