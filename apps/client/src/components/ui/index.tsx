'use client'
import { cn, repColor, statusCfg } from '@/lib/data'

export function Card({ children, className, hover }: { children:React.ReactNode; className?:string; hover?:boolean }) {
  return (
    <div className={cn('stone-card p-5 transition-all duration-200', hover && 'cursor-pointer hover:shadow-cardHover', className)}>
      {children}
    </div>
  )
}

export function CardLabel({ children, className }: { children:React.ReactNode; className?:string }) {
  return (
    <div className={cn('font-mono text-[10px] text-jadeMid uppercase tracking-[0.14em] mb-3', className)}>
      {children}
    </div>
  )
}

export function Badge({ cap }: { cap: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium border bg-jade/15 text-jadeDark border-jade/30">
      {cap}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const c = statusCfg(status)
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-sm text-[11px] font-mono font-semibold border', c.cls)}>
      {c.label}
    </span>
  )
}

export function RepRing({ score, size=52 }: { score:number; size?:number }) {
  const pct  = score / 100
  const r    = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * pct / 100
  const col  = repColor(pct * 100)
  return (
    <div className="relative flex-shrink-0" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(174,184,160,0.3)" strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="4"
          strokeDasharray={`${fill} ${circ-fill}`} strokeLinecap="round"/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-[12px]"
        style={{color:col}}>
        {(pct).toFixed(0)}
      </div>
    </div>
  )
}

export function Button({
  children, onClick, variant='primary', size='md', className, disabled
}: {
  children:React.ReactNode; onClick?:()=>void
  variant?:'primary'|'secondary'|'danger'|'ghost'
  size?:'sm'|'md'|'lg'; className?:string; disabled?:boolean
}) {
  const v: Record<string,string> = {
    primary:   'bg-jadeDeep text-stone hover:bg-moss border-transparent',
    secondary: 'bg-jade/15 text-jadeDark border-jade/35 hover:bg-jade/25',
    danger:    'bg-danger/8 text-danger border-danger/25 hover:bg-danger/15',
    ghost:     'bg-transparent text-muted border-transparent hover:text-jadeDeep hover:bg-jade/15',
  }
  const s: Record<string,string> = {
    sm: 'px-3 py-1.5 text-[12px] rounded-sm',
    md: 'px-4 py-2 text-[13px] rounded-sm',
    lg: 'px-5 py-2.5 text-[14px] rounded-sm',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('font-semibold transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed', v[variant], s[size], className)}>
      {children}
    </button>
  )
}

export function Input({ label, className, ...props }: { label?:string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-3">
      {label && <label className="block font-mono text-[11px] text-jadeMid mb-1.5">{label}</label>}
      <input
        className={cn(
          'w-full bg-stone border border-jade/25 rounded-sm px-3.5 py-2.5',
          'text-ink font-mono text-[13px] placeholder:text-jade/60 outline-none',
          'focus:border-jadeDark focus:bg-white transition-all',
          className
        )}
        {...props}
      />
    </div>
  )
}

export function StatTile({ label, value, sub, valueClass }: { label:string; value:string; sub?:string; valueClass?:string }) {
  return (
    <div className="bg-jade/10 border border-jade/20 rounded-sm p-3">
      <div className="font-mono text-[10px] text-jadeMid uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('font-display text-[15px] font-semibold text-moss', valueClass)}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  )
}
