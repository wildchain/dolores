Story 2.1 — Receipt Upload

Task: Set up Express server with POST /receipts/upload endpoint
Task: Validate incoming JSON receipt schema (agentId, taskId, outputHash, timestamp)
Task: Upload receipt to NFT.storage (free IPFS) using their SDK
Task: Return IPFS CID to caller
Task: Store CID + agentId + taskId mapping in SQLite
Story 2.2 — Receipt Retrieval

Task: Build GET /receipts/:taskId endpoint returning full receipt JSON
Task: Build GET /receipts/agent/:agentId returning list of all receipts for an agent
Task: Add CID verification (hash check against on-chain output_hash)

 

Task: Create SQLite schema — tables: agents, attestations, slashes, reputation_snapshots
Task: Build polling job: every 30s call getProgramAccounts and upsert results into SQLite
Task: Build GET /agents endpoint returning all registered agents from SQLite (< 300ms)
Task: Build GET /agents/:id returning single agent reputation record
Story 3.2 — Dashboard Data Endpoints

Task: GET /agents/:id/history — returns attestation list for an agent
Task: GET /stats — returns total agents, total attestations, total slashes (for dashboard counters)
Task: Test all endpoints return in under 1s

 

Story 4.1 — x402 Integration

Task: Install and configure x402 middleware for Express
Task: Set up facilitator connection (Coinbase x402 facilitator on devnet)
Task: Define payment amount: 0.001 USDC per request
Task: Gate GET /registry/:agentId behind x402 middleware
Task: Test payment flow: request → 402 response → client pays → data returned
Story 4.2 — Gated Registry Endpoint

Task: Build GET /registry/:agentId returning structured ReputationRecord JSON
Task: ReputationRecord schema: { agentId, reputationScore, slashCount, stakedAmount, lastAttestation, codeHash }
Task: Add batch endpoint POST /registry/batch (up to 10 agents, costs 0.005 USDC) — gated same way
Task: End-to-end test: pay via x402 → receive ReputationRecord → verify data matches on-chain PDA
 Story 5.1 — Arweave Setup

Task: Install arweave npm package
Task: Set up Arweave wallet (generate JWK, fund with small AR on testnet)
Task: Build uploadToArweave(snapshot) utility function
Task: Test upload + confirm transaction ID returned
Story 5.2 — Reputation Snapshot Storage

Task: Define snapshot schema: { agentId, reputationScore, slashCount, attestationCount, timestamp, previousCid }
Task: Trigger snapshot upload after every successful attestation
Task: After upload, call on-chain program to anchor Arweave TxID into Registry PDA codex_cid field
Task: Build GET /agents/:id/snapshots endpoint returning list of all Arweave TxIDs for an agent (full audit trail)
Task: Test full flow: attestation fires → snapshot created → uploaded to Arweave → TxID anchored on-chain
Story 5.3 — Snapshot Verification

Task: Build GET /verify/:txId endpoint that fetches snapshot from Arweave and compares to current on-chain state
Task: Returns { verified: true/false, delta: {...} } — useful for the demo to show tamper-proof history
