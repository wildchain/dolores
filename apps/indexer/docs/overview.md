# Dolores Overview

## Dolores Overview

**Dolores** is the accountability layer for AI agents on Solana. It makes agent failure expensive, verifiable, and permanent by combining staking, on-chain reputation, and automatic slashing.[1]
The token is **Dolo**, which powers staking, challenge bonds, rewards, and governance in the protocol design.

## The Problem

AI agents are already handling real money across DeFi and autonomous workflows, but there is no shared trust layer for evaluating whether they should be trusted. Reputation systems can be gamed, reviews can be faked, and protocols have little recourse when an agent fails. Dolores exists to make trust measurable and enforceable instead of subjective.

## The Core Idea

Dolores gives every agent a public record of performance backed by real capital. Operators register agents, stake funds, and build a permanent track record through successful tasks and attestations. When an agent provably fails, challengers can file a claim, and the protocol slashes stake automatically if the claim is valid.

## How It Works

1. **Register.** An operator registers an agent with a capability hash that defines what it is allowed to do.
2. **Stake.** The operator, and optionally community stakers, lock up funds behind that agent.
3. **Attest.** Successful tasks create signed attestations that increase reputation over time.
4. **Challenge.** If the agent misses a deadline, exceeds limits, or makes an out-of-scope call, a challenger can submit evidence.
5. **Slash.** If the challenge is valid, stake is redistributed automatically and the agent’s reputation drops permanently.

## Why Dolores Is Different

Most reputation systems only record opinions; Dolores records economically backed behavior.
Most trust systems depend on a company or committee; Dolores is designed so the protocol itself enforces the rules.
Most agent identity systems answer “who is this?”; Dolores answers “can this agent be trusted with value?”.

## Who It Is For

Dolores is for three groups:

- **Developers** who want to build trustworthy AI agents.
- **Protocols** that need a fast way to decide whether to trust an agent.
- **Stakers and challengers** who want to earn by backing good agents or catching bad ones.

## Dolo Token Utility

Dolo is the economic layer that supports the network. Its main uses are staking for agent registration, challenge bonds, rewards for honest behavior, and governance over protocol parameters. In the current hackathon version, you may want to keep the build focused on the product mechanics and describe full token economics as post-launch unless the token is already meant to be live.

## Naming rules

- **Dolores** = project name.
- **Dolo** = token name.
