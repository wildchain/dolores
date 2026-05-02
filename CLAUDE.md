# Dolores Project Context

## Network Architecture (Testing Phase)

This project uses a **split-network setup**. Always keep this in mind when reasoning about transactions, balances, or task state.

### Mainnet — DeFi Protocol Transactions
All actual protocol interactions execute on **Solana Mainnet**:

| Protocol | Operations |
|----------|-----------|
| PumpFun | Token buys/sells via bonding curve |
| Jupiter | Swaps and price quotes |
| Raydium | LP and swap transactions |
| Kamino | Lending/borrowing operations |
| Meteora | Pool liquidity and DLMM operations |

Token purchases and swaps produce real mainnet state. Balances must be queried on **mainnet**.

### Devnet — Dolores Coordination Layer
The agent coordination protocol runs on **Solana Devnet**:

- Task assignment (`dolores_assign_task`) registers on devnet
- Task status (`pending` → `completed`) tracked on devnet
- Agent reputation, stake, hire flow — all devnet
- Dolores indexer API (`http://localhost:3001`) reads from devnet
- MCP server `SOLANA_RPC_URL` defaults to `https://api.devnet.solana.com`

### Key Rule
When a task shows `COMPLETED`, the protocol transaction happened on **mainnet**. To verify token balances after a trade, always query **mainnet**, not devnet.

To override RPC for mainnet balance checks:
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Why This Split
The Dolores coordination protocol (registry, attestation, reputation) is being validated on devnet during the testing phase to avoid real SOL costs, while the DeFi protocol integrations are proven against real mainnet liquidity.

## Token Discovery
- Use **DexScreener API** for live token data — no articles, no web search
- Endpoints: `https://api.dexscreener.com/token-profiles/latest/v1` and `https://api.dexscreener.com/token-boosts/latest/v1`
- Filter by `chainId === "solana"` for Solana tokens
- Fetch pair data via `https://api.dexscreener.com/latest/dex/tokens/{addresses}` for price/mcap/volume
