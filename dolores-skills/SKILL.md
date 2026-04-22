---
name: dolores-protocol
description: >
  Trust and accountability layer for AI agents on Solana. Dolores makes agent
  failure expensive — automatically, permanently, and without a central authority.
  Use these skills to register agents, assign tasks, verify trust, and integrate
  accountability patterns into any DeFi agent you build.
license: MIT
metadata:
  author: dolores-protocol
  version: "0.1.0"
tags:
  - dolores
  - solana
  - agent-accountability
  - reputation
  - staking
  - slashing
  - trust-layer
  - defi
  - sol-transfer
---

# Dolores Protocol Skills

Skills for building accountable AI agents on Solana.

Every DeFi skill on `solana.com/skills` teaches an agent **how** to use a
protocol. None of them answer **whether** that agent should be trusted.

Dolores is the trust layer underneath every skill.

```
Jupiter Skill  → teaches agent HOW to trade
Kamino Skill   → teaches agent HOW to lend
Dolores Skill  → answers WHETHER to trust the agent doing all of the above
```

## Install

```bash
npx skills add https://github.com/dolores-protocol/dolores-skills
```

## Available Skills

| Skill | What it covers |
|---|---|
| [dolores-core](./skills/dolores-core/SKILL.md) | Registration, staking, verify_agent() CPI, receipt patterns |
| [sol-transfer](./skills/sol-transfer/SKILL.md) | Native SOL transfers via System Program with full accountability |

## On-Chain Programs (Solana devnet)

| Program | ID |
|---|---|
| dolores_registry | `8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt` |
| dolores_fund | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` |
| dolores_adjudication | `4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz` |

## How it fits with other skills

Install Dolores alongside any DeFi skill:

```bash
npx skills add https://github.com/jup-ag/agent-skills   # Jupiter
npx skills add https://github.com/dolores-protocol/dolores-skills  # Dolores
```

Claude Code will then generate agents that:
- Verify trust before executing (`verify_agent()`)
- Produce signed execution receipts after every action
- Are automatically slashed for missed deadlines or out-of-scope calls

## CLI Quick Reference

```bash
dolores register    # create agent keypair + register on-chain
dolores stake       --agent-id <pubkey> --amount 0.5
dolores assign      --agent-id <pubkey> --instruction "transfer 0.001 SOL to <pubkey>"
dolores task-status --task-id <hex>
dolores verify      --agent-id <pubkey> --min-rep 100 --min-stake 0.1
dolores history     --agent-id <pubkey>
dolores challenge   --agent-id <pubkey> --type missed-deadline
```