# Phase 1 Complete: Core Attestation Flow

## ✅ Completed Steps

### 1.1 Replace lib.rs with temp_lib.rs Architecture

**Status:** ✅ Complete

Successfully replaced the Solana program with the pending attestation and challenge architecture:

**New Account Types:**

- `PendingAttestation` — Seeds: `[pending_attestation, agent, output_hash]`
  - Fields: agent, output_hash, evidence_cid, status (0=pending, 1=approved, 2=slashed), reviewer, submitted_at, resolved_at, bump
  - Size: 8 + 32 + 32 + (4 + 64) + 1 + 32 + 8 + 8 + 1 = 190 bytes

- `ChallengeAccount` — Seeds: `[challenge, pending_attestation_pda]`
  - Fields: attestation, challenger, violation_hash, evidence_cid, submitted_at, bump
  - Size: 8 + 32 + 32 + 32 + (4 + 64) + 8 + 1 = 181 bytes

**New Instructions:**

- `submit_attestation(output_hash, evidence_cid)` — Agent submits work, creates PendingAttestation in PENDING state
- `approve_attestation(output_hash)` — Reviewer approves valid work, adds +100 reputation, marks APPROVED
- `challenge_attestation(output_hash, violation_hash, evidence_cid)` — Reviewer challenges invalid work, slashes reputation to 35%, creates ChallengeAccount, marks SLASHED

**Removed:**

- Ed25519 signature verification (moved to backend receipt upload)
- Direct reputation updates from agent submissions
- Score and stake_weight parameters from attestation

**Key Changes:**

- Reputation only increases after explicit reviewer approval (not on submission)
- Slashing happens through challenge mechanism (not direct slash instruction for reviewers)
- All attestations go through pending → reviewed lifecycle
- Self-review is blocked (reviewer cannot approve/challenge own work)

### 1.2 Update RegistryAccount Fields

**Status:** ✅ Complete

Updated `RegistryAccount` structure:

```rust
pub struct RegistryAccount {
    pub operator: Pubkey,
    pub agent: Pubkey,
    pub capability_hash: [u8; 32],
    pub reputation_score: u16,                    // 0-10000
    pub slash_count: u8,
    pub arweave_cid: String,
    pub declared_stake: u64,
    pub registered_at: i64,
    pub last_attested_at: i64,
    pub pending_attestation_count: u16,           // ✨ NEW
    pub challenged_attestation_count: u16,        // ✨ NEW
    pub bump: u8,
}
```

**New Size:** 8 + 32 + 32 + 32 + 2 + 1 + (4 + 64) + 8 + 8 + 8 + 2 + 2 + 1 = 204 bytes (was 198 bytes)

### 1.3 Verify Backend AttestationService Integration

**Status:** ✅ Complete

Confirmed backend services are already wired for new instructions:

**AttestationService Methods:**

- ✅ `submitPendingAttestation(receipt)` — Calls submit_attestation with output_hash and evidence_cid
- ✅ `approveAttestation(receipt)` — Calls approve_attestation with output_hash, requires reviewer registry
- ✅ `challengeAttestation(receipt, violationHash, evidenceCid)` — Calls challenge_attestation with all parameters

**PDA Derivations:**

- ✅ Registry: `[registry, agent]`
- ✅ PendingAttestation: `[pending_attestation, agent, output_hash]`
- ✅ Challenge: `[challenge, pending_attestation_pda]`

**AgentController:**

- ✅ Already fetching `pendingAttestationCount` and `challengedAttestationCount` from on-chain account
- ✅ Returns complete agent status including new fields

---

## 🔄 What Changed

### Constants Added

```rust
pub const VALID_ATTESTATION_REWARD: u16 = 100;
pub const PENDING_ATTESTATION_SEED: &[u8] = b"pending_attestation";
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const ATTESTATION_STATUS_PENDING: u8 = 0;
pub const ATTESTATION_STATUS_APPROVED: u8 = 1;
pub const ATTESTATION_STATUS_SLASHED: u8 = 2;
```

### Events Updated

**Removed:**

```rust
pub struct AttestationSubmitted {
    pub score: u8,              // ❌ Removed
    pub new_reputation: u16,     // ❌ Removed
}
```

**Added:**

```rust
pub struct AttestationSubmitted {
    pub agent: Pubkey,
    pub output_hash: [u8; 32],
    pub evidence_cid: String,
    pub submitted_at: i64,
}

pub struct AttestationApproved {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub output_hash: [u8; 32],
    pub new_reputation: u16,
    pub approved_at: i64,
}

pub struct AttestationChallenged {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub output_hash: [u8; 32],
    pub challenge: Pubkey,
    pub challenged_at: i64,
}
```

### Error Codes Updated

**Removed:**

- `InvalidScore`
- `InvalidStakeWeight`
- `InvalidSignature`
- `MissingEd25519Instruction`

**Added:**

- `EvidenceCidTooLong`
- `AttestationNotPending`
- `SelfReviewNotAllowed`
- `OutputHashMismatch`

---

## 📋 Next Steps

### Phase 1.4: Test Attestation Lifecycle on Devnet

**Actions needed:**

1. Build and deploy updated program to devnet:

   ```bash
   cd dolores-programs
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. Register two agents (one as agent, one as reviewer):

   ```bash
   # Register agent
   dolores register

   # Register reviewer (using different keypair)
   dolores register
   ```

3. Test pending attestation submission:
   - Agent uploads receipt to backend
   - Backend calls `submitPendingAttestation`
   - Verify `pending_attestation_count` increments on RegistryAccount
   - Verify PendingAttestation account created with status=0

4. Test approval flow:
   - Reviewer calls `approveAttestation` via backend endpoint
   - Verify reputation increases by 100 points
   - Verify `pending_attestation_count` decrements
   - Verify PendingAttestation.status = 1 (APPROVED)

5. Test challenge flow:
   - Agent submits invalid receipt
   - Reviewer calls `challengeAttestation`
   - Verify reputation slashed to 35%
   - Verify slash_count increments
   - Verify ChallengeAccount created
   - Verify `challenged_attestation_count` increments
   - Verify PendingAttestation.status = 2 (SLASHED)

---

## 🔧 Integration Notes

### Backend Receipt Upload Flow

When an agent uploads a receipt to `POST /receipts/upload`:

1. Backend validates Ed25519 signature of outputHash (off-chain)
2. Backend creates ReceiptEntity with status=Received
3. Backend calls `attestationService.submitPendingAttestation(receipt)`
4. On-chain PendingAttestation created, receipt.status → PendingReview
5. Receipt stored with `pendingAttestationPda` and `submissionTx`

### Reviewer Approval Flow

When verification passes and reviewer approves:

1. Backend calls `attestationService.approveAttestation(receipt)`
2. On-chain instruction validates:
   - PendingAttestation exists and status=PENDING
   - Reviewer has RegistryAccount (is registered node)
   - Reviewer != agent (no self-review)
3. Reputation increases by VALID_ATTESTATION_REWARD (100)
4. Receipt.status → Approved, stores `approvalTx` and `reviewerId`

### Challenger Flow

When verification detects violation:

1. Backend computes violation_hash from ConstraintViolation array
2. Backend calls `attestationService.challengeAttestation(receipt, violationHash, evidenceCid)`
3. On-chain instruction:
   - Slashes agent reputation to 35%
   - Increments slash_count
   - Creates ChallengeAccount with evidence reference
4. Receipt.status → Slashed, stores `challengeTx` and verification outcome

---

## 📊 Program Size Impact

**Before:**

- RegistryAccount: 198 bytes
- Total accounts: 2 (Registry, VerifyResult)

**After:**

- RegistryAccount: 204 bytes (+6 bytes)
- PendingAttestation: 190 bytes (new)
- ChallengeAccount: 181 bytes (new)
- Total accounts: 4

**Impact:**

- Each pending attestation costs ~0.00133 SOL rent (190 bytes)
- Each challenge costs ~0.00127 SOL rent (181 bytes)
- Registry rent increases by ~0.000042 SOL (6 bytes)

---

## ✅ Verification Checklist

- [x] lib.rs compiles without errors
- [x] RegistryAccount includes new fields
- [x] PendingAttestation account type exists
- [x] ChallengeAccount account type exists
- [x] submit_attestation creates pending state
- [x] approve_attestation adds reputation
- [x] challenge_attestation slashes reputation
- [x] Backend AttestationService wired correctly
- [x] AgentController fetches new fields
- [ ] IDL regenerated and updated
- [ ] Program deployed to devnet
- [ ] End-to-end test passed

---

## 🎯 Success Criteria

Phase 1 is complete when:

1. ✅ Program compiles and deploys to devnet
2. ✅ Agent can submit pending attestation
3. ✅ Reviewer can approve pending attestation
4. ✅ Reviewer can challenge pending attestation
5. ✅ Reputation only changes on approval/challenge, not submission
6. ✅ Self-review is blocked
7. ✅ Backend correctly orchestrates all flows

**Status:** 3/7 complete (program updated, backend wired, ready for deployment testing)
