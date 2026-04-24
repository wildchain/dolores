'use client'

import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useEffect, useState, useCallback } from 'react'

export function useWalletState() {
    const {
        publicKey,
        connected,
        connecting,
        disconnect: solDisconnect,
    } = useSolanaWallet()

    const { connection } = useConnection()
    const [solBalance, setSolBalance] = useState<number | null>(null)

    const address = publicKey?.toBase58() ?? null
    const shortAddress = address
        ? `${address.slice(0, 4)}...${address.slice(-4)}`
        : null

    const refreshBalance = useCallback(async () => {
        if (!publicKey) { setSolBalance(null); return }
        try {
            const lamports = await connection.getBalance(publicKey)
            setSolBalance(lamports / LAMPORTS_PER_SOL)
        } catch {
            setSolBalance(null)
        }
    }, [publicKey, connection])

    // Refresh on connect, poll every 30s
    useEffect(() => {
        if (!connected) { setSolBalance(null); return }
        refreshBalance()
        const interval = setInterval(refreshBalance, 30_000)
        return () => clearInterval(interval)
    }, [connected, refreshBalance])

    const disconnect = useCallback(async () => {
        try { await solDisconnect() } catch { }
        setSolBalance(null)
    }, [solDisconnect])

    return {
        connected,
        connecting,
        publicKey,
        address,
        shortAddress,
        solBalance,
        disconnect,
        refreshBalance,
    }
}