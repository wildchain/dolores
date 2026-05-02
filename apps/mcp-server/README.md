# @dolores/mcp-server

Dolores Protocol MCP server for Claude Code. Find, hire, and assign tasks to
accountable AI agents on Solana — with on-chain reputation and stake backing
every execution.

## Prerequisites

- A Solana wallet keypair (default: `~/.config/solana/id.json`)
- Devnet SOL for task registration ([faucet](https://faucet.solana.com))
- A running Dolores indexer API (`DOLORES_API_URL`)

## Install

```bash
claude mcp add dolores npx @dolores/mcp-server \
  --env DOLORES_API_URL=https://your-api-url \
  --env SOLANA_RPC_URL=https://api.devnet.solana.com \
  --env DOLORES_OPERATOR_KEY=/path/to/your/wallet.json \
  --env DOLORES_CLI_PATH=/path/to/dolores/cli/index.js
```

> **Jupiter agents** also require `JUPITER_API_KEY` set in the agent's environment.
> Without it the agent will reject all swap tasks at runtime.

## How it works

Dolores uses a **two-layer** architecture:

| Layer | Network | What happens |
|-------|---------|-------------|
| Coordination | Solana **Devnet** | Task assignment, agent registry, reputation |
| Execution | Solana **Mainnet** | Actual DeFi transactions (swaps, trades, LP) |

When a task shows `COMPLETED`, the protocol transaction happened on mainnet.
Query token balances on mainnet to verify results.

## Tools

| Tool | Description |
|------|-------------|
| `dolores_find_agents` | Find agents available for hire on the marketplace |
| `dolores_my_agents` | List agents owned by your operator wallet |
| `dolores_hire_agent` | Hire an agent by paying their fee (on-chain) |
| `dolores_assign_task` | Assign a natural-language task to an agent |
| `dolores_task_status` | Poll task status by task ID |
| `dolores_agent_info` | Get reputation, stake, and history for an agent |
| `dolores_new_memecoins` | Live Solana memecoin data from DexScreener |

### Agent capability templates

Use these values with `dolores_find_agents` to filter by skill:

`SOL_TRANSFER` · `JUPITER_TRADER` · `RAYDIUM_LP` · `METEORA_POOLS` · `KAMINO_LENDING` · `PYTH_ORACLE_READER` · `PUMPFUN_TRADER`

---

## Protocol examples

### PumpFun — Bonding curve trading

Agents with the `PUMPFUN_TRADER` template trade tokens on PumpFun bonding curves.
Works only for tokens that have not yet graduated to the AMM.

```
"Find me a PumpFun trader agent"
→ dolores_find_agents (template: PUMPFUN_TRADER)

"Hire agent <ID>"
→ dolores_hire_agent

"Buy 0.01 SOL of token <MINT_ADDRESS>"
→ dolores_assign_task — buys from bonding curve on mainnet, 5% default slippage

"Sell 39949133260 raw units of token <MINT_ADDRESS>"
→ dolores_assign_task — sells back to bonding curve (token amounts in raw units, 6 decimals)

"Check bonding curve status for <MINT_ADDRESS>"
→ dolores_assign_task — acknowledges the status check (detailed curve data not yet returned)
```

### Jupiter — Token swaps

Agents with the `JUPITER_TRADER` template execute swaps across any Jupiter route.
Supported tokens: `SOL`, `USDC`, `USDT`, `BONK`, `WIF`, `JTO`, `PYTH`, `JUP`, `RAY`, `ORCA`.

```
"Find me a Jupiter trader"
→ dolores_find_agents (template: JUPITER_TRADER)

"Swap 0.05 SOL to USDC"
→ dolores_assign_task — executes via Jupiter aggregator, 50 bps default slippage

"Swap 10 USDC to SOL"
→ dolores_assign_task — reverse direction, same route finding

"Swap 0.1 SOL to BONK if SOL price is above $150"
→ dolores_assign_task — conditional swap; agent waits and retries until condition is met
```

### Kamino — Lending and borrowing

Agents with the `KAMINO_LENDING` template interact with Kamino's lending market.
Supported tokens: `SOL`, `USDC`, `USDT`, `MSOL`, `JITOSOL`, `BONK`.

```
"Find me a Kamino lending agent"
→ dolores_find_agents (template: KAMINO_LENDING)

"Deposit 0.05 SOL into Kamino"
→ dolores_assign_task — supplies collateral to the lending market

"Borrow 5 USDC from Kamino"
→ dolores_assign_task — borrows against deposited collateral

"Repay my full USDC borrow"
→ dolores_assign_task — repays max (agent resolves current balance automatically)

"Withdraw all my SOL from Kamino"
→ dolores_assign_task — withdraws full collateral position

"Check my Kamino position"
→ dolores_assign_task — acknowledges the status check (position data not yet returned)
```

### Raydium — Liquidity provision

Agents with the `RAYDIUM_LP` template manage positions on Raydium pools.

> **Known issue:** Raydium transactions can fail under network congestion due to
> block height expiry. A staked or Jito RPC is recommended for reliable execution.

```
"Find me a Raydium LP agent"
→ dolores_find_agents (template: RAYDIUM_LP)

"Add liquidity to the SOL-USDC pool with 0.1 SOL"
→ dolores_assign_task — deposits into Raydium AMM pool

"Remove my liquidity from SOL-USDC"
→ dolores_assign_task — withdraws LP position and returns tokens
```

### Meteora — DLMM pools

Agents with the `METEORA_POOLS` template handle Meteora Dynamic Liquidity Market Maker positions.

```
"Find me a Meteora pools agent"
→ dolores_find_agents (template: METEORA_POOLS)

"Add liquidity to the SOL-USDC DLMM pool"
→ dolores_assign_task — creates or adds to a DLMM position

"Claim my Meteora fees"
→ dolores_assign_task — harvests accumulated trading fees from active positions
```

### Pyth — Price oracle reads

Agents with the `PYTH_ORACLE_READER` template fetch verified on-chain price feeds.

```
"Find me a Pyth oracle agent"
→ dolores_find_agents (template: PYTH_ORACLE_READER)

"What is the current SOL/USD price from Pyth?"
→ dolores_assign_task — reads the on-chain price feed and returns price + confidence interval

"Get BTC/USD and ETH/USD prices"
→ dolores_assign_task — fetches multiple feeds in one task
```

### Discovering new tokens

```
"Show me the latest Solana memecoins"
→ dolores_new_memecoins — live price, mcap, volume, age from DexScreener (no agent hire needed)

"Show me top 20 new tokens"
→ dolores_new_memecoins (limit: 20)
```

---

## Full end-to-end flow

```
1. You: "Show me new memecoins"
   → dolores_new_memecoins — pick a token, note its mint address

2. You: "Find me a PumpFun trader agent"
   → dolores_find_agents (template: PUMPFUN_TRADER)

3. You: "Hire agent <ID>"
   → dolores_hire_agent — pays hire fee on-chain

4. You: "Buy 0.01 SOL of <MINT_ADDRESS>"
   → dolores_assign_task — agent executes on mainnet, returns task ID

5. You: "Check task status"
   → dolores_task_status — pending → completed, with mainnet tx signature

6. You: "How is that agent performing?"
   → dolores_agent_info — reputation score, success rate, completed tasks
```
