'use client'
import { useState } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWalletState } from '@/hooks/useWalletState'

export function WalletButton() {
    const { setVisible } = useWalletModal()
    const { connected, connecting, shortAddress, solBalance, disconnect } = useWalletState()
    const [open, setOpen] = useState(false)

    // ── Not connected ──────────────────────────────────────────────
    if (!connected) {
        return (
            <button
                onClick={() => setVisible(true)}
                disabled={connecting}
                className="px-4 py-1.5 rounded-sm text-[13px] font-semibold bg-jadeDeep text-stone hover:bg-moss transition-colors disabled:opacity-60"
            >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
        )
    }

    // ── Connected ──────────────────────────────────────────────────
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-[13px] font-medium
          bg-jade/15 border border-jade/35 text-jadeDark hover:bg-jade/25 transition-all"
            >
                {/* Live green dot */}
                <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />

                {/* Short address */}
                <span className="font-mono">{shortAddress}</span>

                {/* SOL balance */}
                {solBalance !== null && (
                    <span className="text-[11px] font-mono bg-success/10 text-success px-1.5 py-0.5 rounded-sm">
                        {solBalance.toFixed(3)} SOL
                    </span>
                )}

                {/* Chevron */}
                <svg
                    className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12" fill="none"
                >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <>
                    {/* Click-away overlay */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

                    <div
                        className="absolute right-0 top-full mt-1.5 w-52 rounded-sm z-50 py-1.5 overflow-hidden"
                        style={{
                            background: '#F4F2ED',
                            border: '1px solid rgba(174,184,160,0.4)',
                            boxShadow: '0 4px 20px rgba(36,40,32,0.12)',
                        }}
                    >
                        {/* Address label */}
                        <div className="px-4 py-2.5 font-mono text-[11px]"
                            style={{ borderBottom: '1px solid rgba(174,184,160,0.2)' }}>
                            <div className="text-jadeMid text-[10px] mb-0.5">Connected</div>
                            <div className="text-moss font-medium">{shortAddress}</div>
                        </div>

                        {/* Copy address */}
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(shortAddress ?? '')
                                setOpen(false)
                            }}
                            className="w-full text-left px-4 py-2 text-[13px] text-moss hover:bg-jade/15 transition-all"
                        >
                            Copy address
                        </button>

                        {/* Change wallet */}
                        <button
                            onClick={() => { setVisible(true); setOpen(false) }}
                            className="w-full text-left px-4 py-2 text-[13px] text-moss hover:bg-jade/15 transition-all"
                        >
                            Change wallet
                        </button>

                        {/* View on Explorer */}
                        <a
                            href={`https://explorer.solana.com/address/${shortAddress?.replace('...', '')}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="block px-4 py-2 text-[13px] text-moss hover:bg-jade/15 transition-all"
                        >
                            View on Explorer ↗
                        </a>

                        {/* Divider */}
                        <div className="mx-3 my-1 h-px" style={{ background: 'rgba(174,184,160,0.2)' }} />

                        {/* Disconnect */}
                        <button
                            onClick={() => { disconnect(); setOpen(false) }}
                            className="w-full text-left px-4 py-2 text-[13px] text-danger hover:bg-danger/8 transition-all"
                        >
                            Disconnect
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}