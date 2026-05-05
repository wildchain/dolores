use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;

pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

declare_id!("3LBwDJqrDqoaimGa5JgpZXx3DiupDsiVHJAgAJTXmRey");

/// Trust score scale: 0–1000
pub const MAX_TRUST_SCORE: u16 = 1_000;

pub const ARWEAVE_CID_MAX_LEN: usize = 64;
pub const REGISTRY_SEED: &[u8] = b"registry";

// Access tier thresholds (0–1000 scale)
pub const TIER_EXEMPLARY_MIN: u16 = 850;
pub const TIER_ESTABLISHED_MIN: u16 = 650;
pub const TIER_DEVELOPING_MIN: u16 = 400;
pub const TIER_PROVISIONAL_MIN: u16 = 150;

#[program]
pub mod dolores_registry {
    use super::*;

    pub fn register_agent(ctx: Context<RegisterAgent>, capability_hash: [u8; 32]) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        registry.operator = ctx.accounts.operator.key();
        registry.agent = ctx.accounts.agent.key();
        registry.capability_hash = capability_hash;
        registry.reputation_score = 0;
        registry.slash_count = 0;
        registry.arweave_cid = String::new();
        registry.declared_stake = 0;
        registry.registered_at = clock.unix_timestamp;
        registry.last_attested_at = 0;
        registry.bump = ctx.bumps.registry;
        registry.weighted_score_sum = 0;
        registry.weighted_task_sum = 0;
        registry.total_task_count = 0;
        registry.challenge_survival_count = 0;
        registry.validator_alignment_points = 0;

        emit!(AgentRegistered {
            agent: registry.agent,
            operator: registry.operator,
            capability_hash,
            registered_at: registry.registered_at,
        });

        Ok(())
    }

    pub fn submit_attestation(
        ctx: Context<SubmitAttestation>,
        score: u8,
        output_hash: [u8; 32],
        agent_signature: [u8; 64],
        stake_weight: u8,
    ) -> Result<()> {
        require!(score <= 100, RegistryError::InvalidScore);
        require!(stake_weight <= 10, RegistryError::InvalidStakeWeight);

        verify_ed25519_ix(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.registry.agent,
            &output_hash,
            &agent_signature,
        )?;

        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        // Accumulate stake-weighted attestation components
        registry.weighted_score_sum = registry
            .weighted_score_sum
            .saturating_add((score as u32).saturating_mul(stake_weight as u32));
        registry.weighted_task_sum = registry
            .weighted_task_sum
            .saturating_add(stake_weight as u32);
        registry.total_task_count = registry.total_task_count.saturating_add(1);
        registry.last_attested_at = clock.unix_timestamp;

        // Recompute trust score from full formula
        let new_score = compute_trust_score(registry, clock.unix_timestamp);
        registry.reputation_score = new_score;

        emit!(AttestationSubmitted {
            agent: registry.agent,
            score,
            output_hash,
            trust_score: new_score,
            attested_at: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn verify_agent(
        ctx: Context<VerifyAgent>,
        min_score: u16,
        min_stake_lamports: u64,
    ) -> Result<bool> {
        let registry = &ctx.accounts.registry;
        let clock = Clock::get()?;

        // Always compute fresh — tenure grows continuously without new attestations
        let current_score = compute_trust_score(registry, clock.unix_timestamp);

        let meets_score = current_score >= min_score;
        let meets_stake = registry.declared_stake >= min_stake_lamports;
        // 5+ slashes: 0.35^5 ≈ 0.5% — score is functionally zero; hard-ban for safety
        let not_banned = registry.slash_count < 5;

        let trusted = meets_score && meets_stake && not_banned;

        let result = &mut ctx.accounts.verify_result;
        result.agent = registry.agent;
        result.trusted = trusted;
        result.checked_at = clock.unix_timestamp;
        result.bump = ctx.bumps.verify_result;

        emit!(AgentVerified {
            agent: registry.agent,
            caller: ctx.accounts.caller.key(),
            trusted,
            trust_score: current_score,
        });

        Ok(trusted)
    }

    pub fn write_arweave_cid(ctx: Context<WriteArweaveCid>, cid: String) -> Result<()> {
        require!(cid.len() <= ARWEAVE_CID_MAX_LEN, RegistryError::CidTooLong);

        let registry = &mut ctx.accounts.registry;
        registry.arweave_cid = cid.clone();

        emit!(ArweaveCidUpdated {
            agent: registry.agent,
            cid,
            updated_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn record_slash(ctx: Context<RecordSlash>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        registry.slash_count = registry.slash_count.saturating_add(1);

        // Recompute: 0.35^n slash multiplier is now baked into compute_trust_score
        let new_score = compute_trust_score(registry, clock.unix_timestamp);
        registry.reputation_score = new_score;

        emit!(AgentSlashed {
            agent: registry.agent,
            slash_count: registry.slash_count,
            trust_score: new_score,
            slashed_at: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn update_declared_stake(
        ctx: Context<UpdateDeclaredStake>,
        stake_lamports: u64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        registry.declared_stake = stake_lamports;

        // Stake depth is a bonus component — recompute score
        let new_score = compute_trust_score(registry, clock.unix_timestamp);
        registry.reputation_score = new_score;

        Ok(())
    }

    /// Record that this agent survived a frivolous challenge (called by adjudication program).
    /// Capped at 20 events; each adds +8 to the challenge survival bonus (max +60).
    pub fn record_challenge_survival(ctx: Context<RecordChallengeSurvival>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        if registry.challenge_survival_count < 20 {
            registry.challenge_survival_count = registry.challenge_survival_count.saturating_add(1);
        }

        let new_score = compute_trust_score(registry, clock.unix_timestamp);
        registry.reputation_score = new_score;

        emit!(ChallengeSurvived {
            agent: registry.agent,
            survival_count: registry.challenge_survival_count,
            trust_score: new_score,
        });

        Ok(())
    }

    /// Set the validator alignment bonus (0–70) for this agent.
    /// Called by the validation consensus program after each peer-review round.
    pub fn set_validator_alignment(
        ctx: Context<SetValidatorAlignment>,
        points: u8,
    ) -> Result<()> {
        require!(points <= 70, RegistryError::InvalidValidatorPoints);

        let registry = &mut ctx.accounts.registry;
        let clock = Clock::get()?;

        registry.validator_alignment_points = points;

        let new_score = compute_trust_score(registry, clock.unix_timestamp);
        registry.reputation_score = new_score;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account structs
// ---------------------------------------------------------------------------

#[account]
#[derive(Default)]
pub struct RegistryAccount {
    pub operator: Pubkey,              // 32
    pub agent: Pubkey,                 // 32
    pub capability_hash: [u8; 32],     // 32  — immutable after registration
    pub reputation_score: u16,         // 2   — cached trust score 0–1000
    pub slash_count: u8,               // 1   — permanent, never resets
    pub arweave_cid: String,           // 4 + ARWEAVE_CID_MAX_LEN
    pub declared_stake: u64,           // 8   — lamports staked (stake depth bonus)
    pub registered_at: i64,            // 8   — used for tenure factor
    pub last_attested_at: i64,         // 8
    pub bump: u8,                      // 1
    // Trust score components
    pub weighted_score_sum: u32,       // 4   — Σ (score_i × stake_weight_i)
    pub weighted_task_sum: u32,        // 4   — Σ stake_weight_i (attestation denominator)
    pub total_task_count: u32,         // 4   — number of attested tasks
    pub challenge_survival_count: u8,  // 1   — survived frivolous challenges (max 20)
    pub validator_alignment_points: u8, // 1  — 0–70, set by validation consensus
}

impl RegistryAccount {
    pub const LEN: usize = 8  // discriminator
        + 32  // operator
        + 32  // agent
        + 32  // capability_hash
        + 2   // reputation_score
        + 1   // slash_count
        + (4 + ARWEAVE_CID_MAX_LEN) // arweave_cid
        + 8   // declared_stake
        + 8   // registered_at
        + 8   // last_attested_at
        + 1   // bump
        + 4   // weighted_score_sum
        + 4   // weighted_task_sum
        + 4   // total_task_count
        + 1   // challenge_survival_count
        + 1;  // validator_alignment_points
}

#[account]
pub struct VerifyResult {
    pub agent: Pubkey,   // 32
    pub trusted: bool,   // 1
    pub checked_at: i64, // 8
    pub bump: u8,        // 1
}

impl VerifyResult {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 1;
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    pub agent: Signer<'info>,

    #[account(
        init,
        payer  = operator,
        space  = RegistryAccount::LEN,
        seeds  = [REGISTRY_SEED, agent.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, RegistryAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitAttestation<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    #[account(address = ix_sysvar::ID)]
    /// CHECK: This account is used to read instruction sysvar for signature verification
    pub instructions_sysvar: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct VerifyAgent<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    #[account(
        init,
        payer  = caller,
        space  = VerifyResult::LEN,
        seeds  = [b"verify", caller.key().as_ref(), registry.agent.as_ref()],
        bump
    )]
    pub verify_result: Account<'info, VerifyResult>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WriteArweaveCid<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
        constraint = registry.operator == authority.key() @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, RegistryAccount>,
}

#[derive(Accounts)]
pub struct RecordSlash<'info> {
    /// TODO production: constrain to adjudication program PDA, not operator.
    pub slash_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,
}

#[derive(Accounts)]
pub struct UpdateDeclaredStake<'info> {
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
        constraint = registry.operator == operator.key() @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, RegistryAccount>,
}

#[derive(Accounts)]
pub struct RecordChallengeSurvival<'info> {
    /// TODO production: constrain to adjudication program PDA.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,
}

#[derive(Accounts)]
pub struct SetValidatorAlignment<'info> {
    /// TODO production: constrain to validation consensus program PDA.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub operator: Pubkey,
    pub capability_hash: [u8; 32],
    pub registered_at: i64,
}

#[event]
pub struct AttestationSubmitted {
    pub agent: Pubkey,
    pub score: u8,
    pub output_hash: [u8; 32],
    pub trust_score: u16,
    pub attested_at: i64,
}

#[event]
pub struct AgentVerified {
    pub agent: Pubkey,
    pub caller: Pubkey,
    pub trusted: bool,
    pub trust_score: u16,
}

#[event]
pub struct ArweaveCidUpdated {
    pub agent: Pubkey,
    pub cid: String,
    pub updated_at: i64,
}

#[event]
pub struct AgentSlashed {
    pub agent: Pubkey,
    pub slash_count: u8,
    pub trust_score: u16,
    pub slashed_at: i64,
}

#[event]
pub struct ChallengeSurvived {
    pub agent: Pubkey,
    pub survival_count: u8,
    pub trust_score: u16,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum RegistryError {
    #[msg("Score must be between 0 and 100")]
    InvalidScore,
    #[msg("Stake weight must be between 0 and 10")]
    InvalidStakeWeight,
    #[msg("Arweave CID exceeds maximum length of 64 bytes")]
    CidTooLong,
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
    #[msg("Ed25519 signature verification failed")]
    InvalidSignature,
    #[msg("Missing Ed25519 instruction in transaction")]
    MissingEd25519Instruction,
    #[msg("Validator alignment points must be between 0 and 70")]
    InvalidValidatorPoints,
}

// ---------------------------------------------------------------------------
// Trust score computation
// ---------------------------------------------------------------------------

/// score = (primary × 850 + bonuses) × slash_multiplier
///
/// primary = attestation_rate × task_stake_weight × tenure_factor
///
/// Bonuses:
///   stake_depth        max +50   (+5 per SOL declared, capped at 10 SOL)
///   challenge_survival max +60   (+8 per survived challenge, capped at 7 events → 56; or min(n*8,60))
///   validator_alignment max +70  (set externally by consensus program)
///
/// slash_multiplier = 0.35^n  (each slash multiplies by 0.35 — non-linear, permanent)
fn compute_trust_score(registry: &RegistryAccount, current_time: i64) -> u16 {
    // 1. Attestation rate: Σ(score_i × stake_i) / (100 × Σstake_i)  →  [0, 1] scaled ×1000
    let attestation_rate_1000: u64 = if registry.weighted_task_sum == 0 {
        0
    } else {
        ((registry.weighted_score_sum as u64) * 1_000)
            / (100u64 * registry.weighted_task_sum as u64)
    }
    .min(1_000);

    // 2. Task stake weight multiplier: 1.0×–1.5× based on average stake weight
    //    avg_stake = Σstake_i / n  (0–10 scale)
    //    multiplier = 1.0 + 0.5 × (avg_stake / 10)  →  scaled ×1000 = 1000 + 50×avg
    let task_multiplier_1000: u64 = if registry.total_task_count == 0 {
        1_000
    } else {
        let avg_stake =
            (registry.weighted_task_sum as u64) / (registry.total_task_count as u64);
        (1_000u64 + avg_stake.min(10) * 50).min(1_500)
    };

    // 3. Tenure factor: ln(months + 1) / ln(13), capped at 1.0  →  scaled ×1000
    let secs_elapsed = (current_time - registry.registered_at).max(0) as u64;
    let months = secs_elapsed / (30 * 24 * 3_600);
    let tenure_1000 = tenure_factor_1000(months);

    // primary × 850  (overflow check: max 1000×1500×1000×850 = 1.275×10^12 — fits in u64)
    let primary_score: u64 = attestation_rate_1000
        .saturating_mul(task_multiplier_1000)
        .saturating_mul(tenure_1000)
        .saturating_mul(850)
        / 1_000_000_000;

    // 4. Bonuses
    // Stake depth: +5 per SOL declared, max +50 at 10 SOL
    let stake_sol = registry.declared_stake / 1_000_000_000;
    let stake_bonus: u64 = (stake_sol * 5).min(50);

    // Challenge survival: +8 per event, bonus capped at +60
    let challenge_bonus: u64 = ((registry.challenge_survival_count as u64) * 8).min(60);

    // Validator alignment: 0–70 (set externally)
    let validator_bonus: u64 = (registry.validator_alignment_points as u64).min(70);

    let pre_slash: u64 = (primary_score + stake_bonus + challenge_bonus + validator_bonus)
        .min(MAX_TRUST_SCORE as u64);

    // 5. Slash multiplier: 0.35^n applied to post-bonus score
    let slash_mult_1000 = slash_multiplier_1000(registry.slash_count);

    let final_score = pre_slash.saturating_mul(slash_mult_1000) / 1_000;

    final_score as u16
}

/// Precomputed: ln(m+1) / ln(13) × 1000 for m = 0..=12 (capped at 1000 for m ≥ 12)
fn tenure_factor_1000(months: u64) -> u64 {
    const LOOKUP: [u64; 13] = [
        0,   // m=0
        270, // m=1  ln(2)/ln(13)
        428, // m=2
        540, // m=3
        628, // m=4
        699, // m=5
        759, // m=6
        811, // m=7
        857, // m=8
        898, // m=9
        935, // m=10
        969, // m=11
        1000, // m=12+  (capped)
    ];
    LOOKUP[months.min(12) as usize]
}

/// Precomputed: 0.35^n × 1000 for n = 0..=4 (n≥5 → 5, functionally zero)
fn slash_multiplier_1000(slash_count: u8) -> u64 {
    match slash_count {
        0 => 1_000,
        1 => 350,
        2 => 122, // 350 × 0.35 = 122.5
        3 => 43,  // 122.5 × 0.35 = 42.9
        4 => 15,  // 42.9 × 0.35 = 15.0
        _ => 5,   // ≥5 slashes: effectively blacklisted
    }
}

// ---------------------------------------------------------------------------
// Ed25519 signature verification
// ---------------------------------------------------------------------------

fn verify_ed25519_ix(
    instructions_sysvar: &AccountInfo,
    expected_pubkey: &Pubkey,
    expected_message: &[u8; 32],
    _signature: &[u8; 64],
) -> Result<()> {
    let current_index = ix_sysvar::load_current_index_checked(instructions_sysvar)
        .map_err(|_| error!(RegistryError::MissingEd25519Instruction))?
        as i16;

    for i in (0..current_index).rev() {
        let ix = ix_sysvar::load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| error!(RegistryError::MissingEd25519Instruction))?;

        if ix.program_id != ED25519_PROGRAM_ID {
            continue;
        }

        let data = &ix.data;
        if data.len() < 144 {
            continue;
        }

        let pubkey_bytes: [u8; 32] = data[16..48]
            .try_into()
            .map_err(|_| error!(RegistryError::InvalidSignature))?;

        let message_bytes: [u8; 32] = data[112..144]
            .try_into()
            .map_err(|_| error!(RegistryError::InvalidSignature))?;

        if pubkey_bytes == expected_pubkey.to_bytes() && message_bytes == *expected_message {
            return Ok(());
        }
    }

    Err(error!(RegistryError::MissingEd25519Instruction))
}
