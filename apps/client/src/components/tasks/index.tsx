'use client'
import { useState } from 'react'
import { StatusBadge, Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import type { Task } from '@/types'

export function TaskCard({ task, onChallenge }: { task:Task; onChallenge:(t:Task)=>void }) {
  return (
    <div className="stone-card p-4 hover:shadow-cardHover transition-all duration-200">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-[11px] text-jadeMid">{task.id}</span>
        <StatusBadge status={task.status}/>
      </div>
      <p className="font-display text-[15px] text-moss mb-2.5 leading-relaxed">{task.description}</p>
      {task.outputHash && (
        <div className="font-mono text-[10px] text-jadeMid bg-jade/10 border border-jade/20 rounded-sm px-2.5 py-1.5 mb-2.5">
          output_hash: {task.outputHash}
        </div>
      )}
      <div className="flex gap-4 font-mono text-[11px] text-jade mb-3">
        <span>deadline: {task.deadline}</span>
        {task.completedAt && <span>done: {task.completedAt}</span>}
        <span>{task.timestamp}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-muted">
          Agent: <span className="text-moss font-medium">{task.agentName}</span>
        </div>
        <div className="flex gap-2">
          {task.arweaveCid && <Button variant="ghost" size="sm" className="text-[11px]">Arweave ↗</Button>}
          {task.status==='completed' && (
            <Button variant="danger" size="sm" className="text-[11px]" onClick={()=>onChallenge(task)}>
              Challenge
            </Button>
          )}
          {task.status==='challenged' && (
            <span className="text-[11px] text-muted px-3 py-1.5 border border-jade/25 rounded-sm">
              Under review
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChallengeModal({ task, onClose }: { task:Task|null; onClose:()=>void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  if (!task) return null
  async function confirm() {
    setLoading(true)
    await new Promise(r=>setTimeout(r,1200))
    setLoading(false); onClose()
    toast('Challenge filed · Bond locked · Auto-adjudicating on-chain...')
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{background:'rgba(36,40,32,0.4)',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div className="stone-card w-full max-w-md p-7 animate-fade-up" onClick={e=>e.stopPropagation()}>
        <h2 className="font-display text-2xl font-medium text-moss mb-1.5">File a Challenge</h2>
        <p className="text-[13px] text-muted mb-5">Evidence verified automatically on-chain. No committee. No appeal.</p>
        <div className="bg-jade/10 border border-jade/20 rounded-sm p-4 mb-4 space-y-2.5">
          {[['Task ID',task.id],['Agent',task.agentName],['Type','Missed deadline'],['Deadline',task.deadline]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-[12px]">
              <span className="text-muted">{k}</span>
              <span className="font-mono text-moss">{v}</span>
            </div>
          ))}
        </div>
        <div className="bg-danger/6 border border-danger/20 rounded-sm p-3.5 mb-5 text-[12px] text-danger/80 leading-relaxed">
          Your bond of <strong className="text-danger">10 USDC</strong> will be locked.
          Valid challenge → bond returned + 60% of slashed stake. Invalid → forfeit.
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={confirm} disabled={loading}>
            {loading?'Filing...':'Confirm Challenge'}
          </Button>
        </div>
      </div>
    </div>
  )
}
