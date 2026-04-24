'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/data'
import { WalletButton } from '@/components/ui/WalletButton'

const LINKS = [
  { href: '/explorer', label: 'Explorer' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/staker', label: 'Staker' },
  { href: '/register', label: 'Register' },
]

export function Navbar() {
  const path = usePathname()
  return (
    <nav className="jade-nav sticky top-0 z-50 flex items-center justify-between px-8 h-14 relative">
      <Link href="/explorer" className="font-display text-xl font-medium text-moss tracking-tight"
        style={{ letterSpacing: '-0.01em' }}>
        Dolores
      </Link>
      <div className="flex items-center gap-0.5">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className={cn(
            'px-3.5 py-1.5 rounded-sm text-[13px] font-medium transition-all duration-150',
            path === l.href
              ? 'bg-jadeDeep text-stone'
              : 'text-jadeDark hover:text-moss hover:bg-jade/20'
          )}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-jadeMid border border-jade/40 px-2 py-0.5 rounded-sm bg-jade/10">
          devnet
        </span>
        <WalletButton />
      </div>
    </nav>
  )
}
