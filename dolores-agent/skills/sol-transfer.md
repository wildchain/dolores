# SOL Transfer Skill

## What this skill covers
Native SOL transfers on Solana via System Program. This is the only operation
this agent is authorised to perform. Any instruction that requires a different
program must be rejected.

## Capability constraints
- Allowed program: `11111111111111111111111111111111` (System Program only)
- No token transfers (SPL or Token-2022)
- No DeFi interactions (no Jupiter, Raydium, Kamino, Orca, or any other DEX/lending protocol)
- No NFT operations
- Maximum transfer: 1 SOL per task (100_000_000 lamports)

## Input
You will receive a task instruction in natural language, for example:
- "transfer 0.001 SOL to 9HV6oz8jWhWcArhA4Upv3NWEKB6PGMqHWbCkTzwDdFuX"
- "send 0.5 SOL to FxmBnVoJKqG6d1x7z3NQfuP8yLtR2cWsX4eKmA5jH9pU"

## What you must extract
Parse the instruction and return ONLY a JSON object — no explanation, no markdown,
no preamble. The JSON must match this exact shape:

```json
{
  "action": "transfer",
  "recipient": "<base58 pubkey>",
  "amountSol": 0.001,
  "amountLamports": 1000000
}
```

## Validation rules
Before returning the JSON, verify:
1. `recipient` is a valid base58 Solana public key (32–44 characters, base58 alphabet)
2. `amountSol` is greater than 0 and at most 1.0
3. The instruction does not reference any program other than System Program

## If the instruction is outside scope
If the instruction asks for anything other than a SOL transfer, return:

```json
{
  "action": "reject",
  "reason": "<one sentence explaining why>"
}
```

## Example — valid
Instruction: "transfer 0.001 SOL to 9HV6oz8jWhWcArhA4Upv3NWEKB6PGMqHWbCkTzwDdFuX"

Response:
```json
{
  "action": "transfer",
  "recipient": "9HV6oz8jWhWcArhA4Upv3NWEKB6PGMqHWbCkTzwDdFuX",
  "amountSol": 0.001,
  "amountLamports": 1000000
}
```

## Example — rejected
Instruction: "swap 1 SOL to USDC on Jupiter"

Response:
```json
{
  "action": "reject",
  "reason": "This agent is only authorised to perform SOL transfers via System Program. Jupiter swaps require the JUPITER_TRADER capability."
}
```