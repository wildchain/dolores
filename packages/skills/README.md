# dolores-skills

Agent skills for the [Dolores Protocol](https://github.com/dolores-protocol) — the trust and accountability layer for AI agents on Solana.

## Install

```bash
npx skills add https://github.com/wildchain/dolores/tree/feat/cli-and-programs/dolores-skills
```

Or install a specific skill:

```bash
npx skills add https://github.com/wildchain/dolores/tree/feat/cli-and-programs/dolores-skills/skills/sol-transfer
```

## Skills

| Skill | Description |
|---|---|
| [dolores-core](./skills/dolores-core/SKILL.md) | Registration, staking, receipts, verify_agent() CPI |
| [sol-transfer](./skills/sol-transfer/SKILL.md) | SOL_TRANSFER template — native SOL transfers with full accountability |

## What is Dolores?

Every DeFi skill teaches an agent **how** to use a protocol.
Dolores answers **whether** that agent should be trusted.

```
Jupiter Skill  → HOW to trade
Kamino Skill   → HOW to lend
Dolores Skill  → WHETHER to trust the agent doing all of the above
```

Dolores makes agent failure **expensive, automatic, and permanent** — without a central authority:

- **Economic staking** — operators stake SOL before their agent can act
- **Automatic slashing** — missed deadlines and out-of-scope calls trigger on-chain slashes with no human involvement
- **Portable reputation** — 0–10000 score, permanent slash count, verifiable via `verify_agent()` CPI

## On-Chain Programs (Solana devnet)

| Program | ID |
|---|---|
| `dolores_registry` | `3LBwDJqrDqoaimGa5JgpZXx3DiupDsiVHJAgAJTXmRey` |
| `dolores_fund` | `AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5` |
| `dolores_adjudication` | `8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A` |

## CLI

```bash
npm install -g dolores-cli

dolores register                                          # create + register agent
dolores stake      --agent-id <pubkey> --amount 0.5      # stake SOL
dolores assign     --agent-id <pubkey> \
                   --instruction "transfer 0.001 SOL to <pubkey>"
dolores task-status --task-id <hex>                      # check task progress
dolores verify     --agent-id <pubkey>                   # check trust level
dolores history    --agent-id <pubkey>                   # reputation history
dolores challenge  --agent-id <pubkey> \
                   --type missed-deadline                 # file challenge
```

## License

MIT