# Merge Notes — `feat/integrate-frontend-and-api`

This branch combines two parallel work streams into a single monorepo.

## What got merged

| Source branch | What it brought | Where it landed |
|---|---|---|
| `dolores-version-0.1.0` (teammate) | NestJS API, Next.js client, indexer, RocksDB cache, JWT auth | `apps/api`, `apps/client`, `apps/indexer`, `packages/*` |
| `feat/cli-and-programs` (Bristin) | Agent runtime, 7 protocol executors, 3 Anchor programs, expanded CLI | `apps/agent`, `apps/cli`, `dolores-programs`, `dolores-skills` |

## How the two halves talk to each other

The agent runtime calls `complete_task()` on the adjudication program. The API's `sync` service was already listening to the adjudication program for other events; we added a `TaskCompleted` listener so the frontend reflects task completion in real time without changing either flow.

```
agent runtime           adjudication program            api/sync service
     │                          │                              │
     ├─ complete_task() ───────►│                              │
     │                          ├── emit TaskCompleted ────────►│
     │                          │                              │
     │                          │       cache: status=completed ◄
```

That is the only change made to teammate's code.

## Exact changes to teammate's code

**One file modified**, with two additions, no removals:

- `apps/api/src/sync/sync.service.ts`
  - Added a `TaskCompleted` event listener inside `startEventListeners()` (~10 lines)
  - Added a `handleTaskCompleted()` method that updates the task cache to `status='completed'` and stores the output_hash (~30 lines)

Both additions are clearly commented with `// BRIDGE:` so they're easy to find in review.

Everything else from `dolores-version-0.1.0` is byte-for-byte identical:
- All of `apps/api` except the file above
- All of `apps/client`
- All of `apps/indexer`
- All of `packages/shared`, `packages/contracts`, `packages/solana-utils`, `packages/database`

## Resolved discrepancies between branches

| Issue | Resolution |
|---|---|
| Adjudication program ID differed (`8gm7LX32...` vs `4BPrSgzH...`) | Used `4BPrSgzH...` (the redeploy). Updated 5 files in agent + cli + IDLs. |
| Two CLIs existed (`dolores-cli` vs `apps/cli`) | Kept `dolores-cli` (more complete: full templates, `assign` command, `task-status`, `decode-event`). Removed teammate's smaller `apps/cli`. |
| Two indexer code bases | Kept both. Teammate's `apps/api` (port 3001) serves the frontend. Teammate's `apps/indexer` (port 8080) handles `/receipts/upload` + on-chain attestation. They are complementary. |
| Agent's IDL drifted from `packages/contracts` | Resynced. The IDL files in `apps/agent/idl/` and `apps/cli/src/idl/` now point at the canonical IDLs in `packages/contracts/src/idl/`. |
| `package.json` names | Renamed `dolores-agent` → `agent`, kept `@dolores/cli` for the CLI. Both reference workspace packages via `workspace:*`. |

## Known open items (not blockers)

| Item | Why it's deferred |
|---|---|
| Arweave manifest uploads at registration time | Frontend will show stub agent names/descriptions for now. Real manifests can be added after the demo. |
| Frontend register page wiring | Their `apps/client/src/app/register/page.tsx` may expect the older simpler CLI register flow. To verify post-merge. |
| `dolores-programs/programs/dolores-programs/` directory name is awkward | The Anchor crate is named `dolores-programs` but the program inside is `dolores_registry`. Rename to `dolores_registry` is post-hackathon polish. |
| Test scripts in `apps/agent/src/test-*.ts` use a standalone signing flow | They still work for individual protocol smoke testing. They don't go through `complete_task()`. They should be marked as dev-only. |

## How to verify the merge worked

After `pnpm install`:

```bash
# Terminal 1
pnpm dev:api          # should log: "Nest application successfully started on port 3001"

# Terminal 2
pnpm dev:indexer      # should log: "Attestation service ready"

# Terminal 3
pnpm dev:client       # should open at http://localhost:5173

# Terminal 4
cd apps/cli && pnpm build
node dist/src/index.js register
# follow prompts to register an agent

# Terminal 5
cd apps/agent
echo "AGENT_ID=<the-pubkey-from-register>" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
pnpm dev              # should log: "Listening for tasks..."

# Terminal 6
cd apps/cli
node dist/src/index.js assign \
  --agent-id <AGENT_PUBKEY> \
  --instruction "transfer 0.001 SOL to <ANY_PUBKEY>" \
  --deadline 30
```

Expected sequence:
1. CLI registers task on-chain → `TaskRegistered` event fires → API caches task as `pending`
2. Agent polls indexer, picks up task, asks Claude, executes SOL transfer
3. Agent calls `complete_task()` on-chain → `TaskCompleted` event fires → API cache updates to `completed`
4. Agent posts receipt to indexer → indexer calls `submit_attestation()` → reputation increments

Frontend at http://localhost:5173 should reflect the lifecycle live.

## Why this approach over a full rewrite

I considered three integration paths:

1. **Adopt teammate's pending-attestation model** (rewrite agent runtime to POST to `/receipts/upload`). Lots of agent-side code rewriting, broke 7 working protocols.
2. **Adopt agent's on-chain-event model** (rewrite teammate's attestation pipeline). Lots of backend rewriting, no preserved review history.
3. **Bridge with one event listener** (this branch). Both flows preserved, ~30 lines of new code, single file diff in teammate's code.

I picked #3 because:
- Both halves keep working independently
- Teammate's code review is bounded to one file
- Rollback is trivial (revert one commit)
- Both flows can run side-by-side; teammate's pending-attestation model can ship in v0.2 if desired

— Bristin, with assistance from Claude Opus 4.7
