'use client'
import { Card, RepRing, Badge, Button } from '@/components/ui'
import { formatUsdc } from '@/lib/data'
import { useToast } from '@/components/ui/Toast'
import type { Agent } from '@/types'

export function AgentCard({ agent }: { agent: Agent }) {
  const { toast } = useToast()
  return (
    <Card hover className={agent.featured ? 'border-l-2 border-l-jadeDark' : ''}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div className="font-mono text-[10px] text-jade mb-1 truncate">{agent.address}</div>
          <div className="font-display text-[18px] font-medium text-moss" style={{letterSpacing:'-0.01em'}}>
            {agent.name}
          </div>
        </div>
        <RepRing score={agent.reputationScore}/>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label:'Staked',  val:`$${formatUsdc(agent.totalStake)}`, cls:'text-jadeDeep font-semibold' },
          { label:'Tasks',   val:agent.totalTasks.toLocaleString(),  cls:'text-moss' },
          { label:'Success', val:`${agent.successRate}%`,            cls:'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-jade/10 border border-jade/20 rounded-sm p-2.5">
            <div className="font-mono text-[10px] text-jade mb-1">{s.label}</div>
            <div className={`font-display text-[14px] ${s.cls}`}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {agent.capability.map(c => <Badge key={c} cap={c}/>)}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <div className={`w-1.5 h-1.5 rounded-full ${agent.slashCount===0?'bg-success':'bg-danger'}`}/>
          {agent.slashCount===0?'No slashes':`${agent.slashCount} slash${agent.slashCount>1?'es':''}`}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm">View</Button>
          <Button size="sm" onClick={() => toast(`Hired ${agent.name}`)}>Hire</Button>
        </div>
      </div>
    </Card>
  )
}
