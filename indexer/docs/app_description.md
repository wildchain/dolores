## The Problem

AI agents are being deployed across DeFi, data feeds, and autonomous workflows with no credible mechanism to hold them accountable. Reputation scores can be gamed. Reviews can be faked. Bad actors face no meaningful deterrent — and protocols have no recourse when an agent fails.

## Mission

Make AI agent misbehaviour economically irrational — automatically, with no one in charge of deciding.

## Vision

A world where any protocol can deploy AI agents with real accountability — not just reputation scores, but money on the line.

## Positioning

The accountability skill for AI agents on Solana. Every DeFi skill teaches an agent how to use a protocol. CLU is the skill that makes that agent answerable for what it does with that knowledge.

## One-sentence pitch

CLU makes AI agents trustworthy by making dishonesty expensive. Operators stake USDC when registering an agent. Every successful task earns a permanent, unfakeable on-chain attestation — building reputation and unlocking rewards. Every failure can be challenged. If the challenge succeeds, the stake is slashed and redistributed automatically. No committees. No appeals to authority. You cannot delete a slash. You cannot start fresh.

---

## How it Works

**00 — Install**

Before a line of agent code is written, a developer runs one command:

`npx skills add clu-protocol/skills`

CLU is a Solana Agent Skill — the same standard that Jupiter, Kamino, and Raydium use to teach AI coding assistants how to interact with their protocols. Those skills teach agents _how_ to act. CLU is the skill that makes agents _answerable_ for what they do. When both are installed, every agent Claude Code generates already includes accountability patterns — execution receipts, output signing, pre-execution trust guards — without the developer writing any CLU-specific code.

**01 — Register**

Operator submits agent identity and a capability hash on-chain. The capability hash is a cryptographic fingerprint of exactly what the agent is authorised to do — which programs it can call, which tokens it can touch, what limits apply. Both the operator's keypair and the agent's keypair must sign the transaction. Permanent, unalterable. Under a second, fraction of a cent.

**02 — Stake**

USDC locked as deposit — by the operator, and optionally by community stakers who back the agent and earn proportional rewards every seven days. Each protocol that integrates CLU sets its own minimum stake threshold. No stake, no access to high-value work. Community stakers win when the agent performs and lose proportionally when it gets slashed. Real skin in the game, not just the operator's.

**03 — Attest**

Every completed task earns a signed on-chain attestation. CLU's auto-attestation watcher monitors Solana transactions and generates these automatically — no protocol integration required. As attestations accumulate, reputation score rises. Higher reputation unlocks access to more protocols. More protocols means more tasks, more attestations, more rewards. Flywheel begins.

**04 — Slash**

Failures challenged by staked challengers. Every challenge must reference a real on-chain TaskRecord — the specific task, the specific deadline, the agent's signed output. Objective failures — missed deadlines, out-of-scope program calls, limit violations — are resolved automatically by the smart contract in under a second. No humans involved. If the challenge succeeds: 60% of slashed stake to the challenger who caught it, 40% to treasury. Reputation drops to 35% of its prior value. Slash count increments permanently. Recorded on Arweave forever. Cannot be removed by anyone.

---

## Competitive Landscape

Solana Agent Registry and SAID Protocol solve agent identity and discovery. CLU solves what they deliberately don't: accountability. Reputation without economic stakes is just Yelp. CLU is the enforcement layer that sits above the registry — the layer that makes identity mean something when money is on the line.

The Skills angle makes this sharper. Every protocol on `solana.com/skills` teaches agents how to act on Solana. CLU is the only skill that makes agents answerable for how they act. We are not competing with Jupiter or Kamino. We sit underneath them.

# Business Model

CLU earns three ways.
A 40% cut of every slashed stake when an agent misbehaves. A 40% cut of every forfeited bond when a challenger files a bad claim. And a per-task platform fee from traders who hire agents through the CLU interface — a small cut of each subscription fee, automatic and on-chain.
All of it flows into the protocol treasury. The short version: we earn when the network grows, and we earn when people misbehave. Both are reliable.
