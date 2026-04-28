---
name: jupiter-trader
description: >
  Dolores-accountable Jupiter swap skill for the JUPITER_TRADER capability template.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
---

# Jupiter Trader Skill (Dolores-Accountable)

**Capability template**: `JUPITER_TRADER`
**Allowed program**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
**Max transfer**: 50,000 USDC equivalent per task

## Verified Token Mint Addresses

Use ONLY these mint addresses. Never guess or hallucinate a mint address.

| Symbol | Mint Address |
|---|---|
| SOL | `So11111111111111111111111111111111111111112` |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwVe` |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixVqXaSL1shNorWMaWRd` |
| WIF | `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm` |
| JTO | `jtojtomepa8berbooxngwuej1y4gbxypibt1mx9buem` |
| PYTH | `HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3` |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |
| RAY | `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R` |
| ORCA | `orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE` |

## Instructions

Parse the user instruction and return ONLY a JSON object.

If the token symbol is in the list above → use that mint address.
If the token symbol is NOT in the list → return a reject action.
Never use a mint address you are not 100% certain about.

## Response Format

Valid swap:
```json
{
  "action": "swap",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inputSymbol": "SOL",
  "outputSymbol": "USDC",
  "amountLamports": 1000000,
  "amountSol": 0.001,
  "slippageBps": 50
}
```

Rejected (token not in verified list or out of scope):
```json
{
  "action": "reject",
  "reason": "Token XYZ is not in the verified token list for this agent."
}
```

## Rules

1. Only swap using tokens from the verified list above
2. Only call Jupiter program — no other DEX
3. Max 1 SOL per swap
4. Default slippageBps is 50 (0.5%)
5. Respond with ONLY the JSON object — no explanation, no markdown