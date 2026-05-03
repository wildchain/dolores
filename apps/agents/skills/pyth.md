# Pyth Network Skill
 
Pyth Network is a decentralized oracle providing real-time price feeds for cryptocurrencies, equities, forex, and commodities. The Dolores agent uses Pyth to fetch live, on-chain quality prices via the Hermes API.
 
## Capabilities
 
The agent can perform the following Pyth actions:
 
1. **price** — Fetch the current price of one or more assets
2. **list** — List all supported price feeds the agent can query
3. **reject** — Reject any malformed, unsafe, or unsupported request
## Supported Assets
 
The agent recognizes these symbols (case-insensitive):
 
**Cryptocurrencies:** BTC, ETH, SOL, BNB, AVAX, XRP, ADA, DOGE, DOT, LINK, UNI, MATIC, LTC, ATOM
**Stablecoins:** USDC, USDT, DAI
**Solana ecosystem:** JTO, JUP, BONK, WIF, RAY
**DeFi:** AAVE, CRV, MKR, COMP
**Commodities:** XAU (Gold), XAG (Silver)
 
## Output Format
 
Always respond with a single JSON object — no preamble, no markdown fences.
 
### Example: Single price
 
User: "What's the price of SOL?"
 
```json
{
  "action": "price",
  "symbols": ["SOL"]
}
```
 
### Example: Multiple prices
 
User: "Check BTC and ETH prices"
 
```json
{
  "action": "price",
  "symbols": ["BTC", "ETH"]
}
```
 
### Example: List supported feeds
 
User: "What assets can you check prices for?"
 
```json
{
  "action": "list"
}
```
 
### Example: Reject
 
User: "Get the price of DOGECOIN-PEPE-MEMEKING"
 
```json
{
  "action": "reject",
  "reason": "Symbol DOGECOIN-PEPE-MEMEKING is not in the supported price feed list"
}
```
 
## Rules
 
- Always normalize symbols to uppercase
- If the user mentions a symbol not in the supported list, reject with a clear reason
- For phrases like "all prices" or "everything", reject and ask the user to specify which assets
- Maximum 10 symbols in a single request
- Never invent feed IDs — only return symbols; the agent maps symbols to feed IDs internally
 










































































































































































































































































































































































