'use client'
import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { CAPABILITY_TEMPLATES } from '@/lib/data'
import { useRouter } from 'next/navigation'
import { useWalletState } from '@/hooks/useWalletState'

const INDEXER = 'http://localhost:8080'

type Step = 1 | 2 | 3 | 4

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {([1, 2, 3, 4] as Step[]).map((s, i) => (
        <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className="w-2 h-2 rounded-sm transition-all duration-300"
            style={{
              background: s <= current ? '#4A5640' : '#AEB8A0',
              boxShadow: s === current ? '0 0 0 3px rgba(107,122,96,0.2)' : 'none',
            }} />
          {i < 3 && (
            <div className="flex-1 h-px transition-all duration-300"
              style={{ background: s < current ? 'rgba(74,86,64,0.5)' : 'rgba(174,184,160,0.3)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function Terminal({ lines }: { lines: { text: string; cls?: string }[] }) {
  return (
    <div className="terminal mb-5">
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: '#171a14', borderBottom: '1px solid rgba(174,184,160,0.1)' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
          <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="p-4 font-mono text-[12px] leading-relaxed space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} style={{
            color: l.cls === 'success' ? '#7EC8A0' : l.cls === 'cmd' ? '#AEB8A0' : 'rgba(174,184,160,0.5)'
          }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()

  // ✅ Hook called inside the component — this is the fix
  const { address, connected } = useWalletState()

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<string[]>(['SOL_TRANSFER'])
  const [agentId, setAgentId] = useState('')
  const [stakeAmt, setStakeAmt] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentData, setAgentData] = useState<any>(null)

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function verifyAndRegister() {
    if (!agentId) { toast('Agent address required', 'error'); return }
    if (!stakeAmt || Number(stakeAmt) < 0.1) {
      toast('Minimum stake is 0.1 SOL', 'error'); return
    }
    setLoading(true)
    try {
      const res = await fetch(`${INDEXER}/agents/${agentId}`)
      if (!res.ok) {
        toast('Agent not found on-chain — run dolores register first', 'error')
        setLoading(false); return
      }
      setAgentData(await res.json())
      setStep(4)
    } catch {
      toast('Could not reach indexer — make sure it is running', 'error')
    } finally {
      setLoading(false)
    }
  }

  const slashExp = stakeAmt && !isNaN(Number(stakeAmt))
    ? `${(Number(stakeAmt) * 0.6).toFixed(4)} SOL`
    : '— SOL'

  return (
    <div className="px-8 py-8 relative z-10">
      <div className="max-w-lg mx-auto">
        <div className="mb-7">
          <div className="ink-rule" />
          <p className="font-mono text-[11px] text-jadeMid uppercase tracking-widest mb-2">Onboarding</p>
          <h1 className="font-display text-4xl font-medium text-moss" style={{ letterSpacing: '-0.02em' }}>
            Register Agent
          </h1>
        </div>

        <StepDots current={step} />

        {step === 1 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-2xl font-medium text-moss mb-2">Register via CLI</h2>
            <p className="text-[14px] text-muted mb-6">
              Registration requires dual-signature — your operator wallet and the agent keypair.
              Run this command to register on devnet.
            </p>
            <Terminal lines={[
              { text: '$ dolores register', cls: 'cmd' },
              { text: '' },
              { text: 'Select template (1–7): 1  ← SOL_TRANSFER' },
              { text: 'Register this agent on-chain? (yes/no): yes' },
              { text: '' },
              { text: '✓ Agent registered on dolores_registry', cls: 'success' },
              { text: '✓ Fund initialized on dolores_fund', cls: 'success' },
              { text: '' },
              { text: '$ dolores stake --agent-id <pubkey> --amount 0.5', cls: 'cmd' },
              { text: '✓ 0.5 SOL staked into vault', cls: 'success' },
            ]} />
            <p className="text-[13px] text-muted mb-5">
              Already registered? Paste your agent pubkey below to confirm it on-chain.
            </p>
            {connected && address && (
              <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-5 font-mono text-[11px]">
                <span className="text-jadeMid">Connected operator: </span>
                <span className="text-jadeDark">{address.slice(0, 20)}...</span>
              </div>
            )}
            <Button className="w-full" size="lg" onClick={() => setStep(2)}>
              Confirm Existing Agent →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-2xl font-medium text-moss mb-2">Choose capability template</h2>
            <p className="text-[14px] text-muted mb-6">
              This must match the template you selected during{' '}
              <span className="font-mono text-jadeDark">dolores register</span>.
              Locked permanently on-chain.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {CAPABILITY_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => toggle(t.id)}
                  className="text-left p-3.5 rounded-sm transition-all border"
                  style={{
                    borderColor: selected.includes(t.id) ? 'rgba(74,86,64,0.5)' : 'rgba(174,184,160,0.3)',
                    background: selected.includes(t.id) ? 'rgba(174,184,160,0.18)' : 'rgba(244,242,237,0.7)',
                  }}>
                  <div className="font-mono text-[12px] font-medium mb-1"
                    style={{ color: selected.includes(t.id) ? '#4A5640' : '#6B7A5C' }}>
                    {t.name}
                  </div>
                  <div className="text-[11px] text-muted leading-relaxed">{t.desc}</div>
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-5 font-mono text-[11px] text-jadeMid">
                selected: <span className="text-jadeDark">{selected.join(', ')}</span>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
              <Button className="flex-1" disabled={selected.length === 0} onClick={() => setStep(3)}>
                Confirm Templates →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-2xl font-medium text-moss mb-2">Confirm agent</h2>
            <p className="text-[14px] text-muted mb-6">
              Paste the agent pubkey printed by{' '}
              <span className="font-mono text-jadeDark">dolores register</span>.
              We will verify it exists on-chain.
            </p>
            {connected && address && (
              <div className="bg-jade/8 border border-jade/20 rounded-sm p-3.5 mb-4 font-mono text-[11px]">
                <span className="text-jadeMid">Operator: </span>
                <span className="text-jadeDark">{address.slice(0, 20)}...</span>
              </div>
            )}
            <Input
              label="Agent pubkey (from dolores register output)"
              placeholder="e.g. 63kvoyq4NcYLSbFHLu76LtEeb4etxax1Dp8yHfh2pVue"
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
            />
            <Input
              label="Amount staked (SOL · minimum 0.1)"
              type="number"
              placeholder="e.g. 0.5"
              value={stakeAmt}
              onChange={e => setStakeAmt(e.target.value)}
            />
            <div className="bg-jade/8 border border-jade/20 rounded-sm p-4 mb-6 space-y-2.5">
              {[
                { k: 'Template selected', v: selected.join(', '), cls: 'text-jadeDark' },
                { k: 'Slash exposure (60% of stake)', v: slashExp, cls: 'text-danger' },
                { k: 'Dual signature', v: 'required — use CLI', cls: 'text-amber' },
                { k: 'Network', v: 'Solana devnet', cls: 'text-jadeMid' },
              ].map(r => (
                <div key={r.k} className="flex justify-between text-[12px]">
                  <span className="text-muted">{r.k}</span>
                  <span className={`font-mono ${r.cls}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
              <Button
                className="flex-1"
                onClick={verifyAndRegister}
                disabled={loading || !connected}
              >
                {loading ? 'Verifying on-chain...' : !connected ? 'Connect wallet first' : 'Verify Agent →'}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-2xl font-medium text-moss mb-2">Agent confirmed</h2>
            <p className="text-[14px] text-muted mb-6">
              Live on devnet. Reputation builds with every verified task.
            </p>
            <Terminal lines={[
              { text: '✓ Agent found on-chain', cls: 'success' },
              { text: `✓ Registry PDA: ${agentData?.registryPda ?? '...'}`, cls: 'success' },
              { text: `✓ Reputation: ${agentData?.reputationScore ?? 0} / 10000`, cls: 'success' },
              { text: `✓ Slash count: ${agentData?.slashCount ?? 0}`, cls: 'success' },
              { text: `✓ Declared stake: ${((agentData?.declaredStake ?? 0) / 1e9).toFixed(4)} SOL`, cls: 'success' },
              { text: '' },
              { text: `agent: ${agentId.slice(0, 20)}...` },
            ]} />
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => router.push('/dashboard')}>
                View Dashboard →
              </Button>
              <Button variant="secondary" onClick={() => router.push('/tasks')}>
                Task Panel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}