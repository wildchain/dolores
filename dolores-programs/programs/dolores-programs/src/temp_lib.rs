use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

declare_id!("8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt");

pub const MAX_REPUTATION: u16 = 10_000;
pub const VALID_ATTESTATION_REWARD: u16 = 100;
pub const SLASH_REPUTATION_MULTIPLIER: u16 = 35;
pub const ARWEAVE_CID_MAX_LEN: usize = 64;

pub const REGISTRY_SEED: &[u8] = b"registry";
pub const PENDING_ATTESTATION_SEED: &[u8] = b"pending_attestation";
pub const CHALLENGE_SEED: &[u8] = b"challenge";

pub const ATTESTATION_STATUS_PENDING: u8 = 0;
pub const ATTESTATION_STATUS_APPROVED: u8 = 1;
pub const ATTESTATION_STATUS_SLASHED: u8 = 2;

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
        registry.pending_attestation_count = 0;
        registry.challenged_attestation_count = 0;
        registry.registered_at = clock.unix_timestamp;
        registry.last_attested_at = 0;
        registry.bump = ctx.bumps.registry;

        emit!(AgentRegistered {
            agent: registry.agent,
            operator: registry.operator,
            capability_hash,
            registered_at: registry.registered_at,
        });

        Ok(())
    }

    pub output_hash: [u8; 32],
        evidence_cid: String,
    ) -> Result<()> {
        require!(
            evidence_cid.len() <= ARWEAVE_CID_MAX_LEN,
            RegistryError::EvidenceCidTooLong
        );

        let registry = &mut ctx.accounts.registry;
        let pending_attestation = &mut ctx.accounts.pending_attestation;
        let clock = Clock::get()?;

        pending_attestation.agent = registry.agent;
        pending_attestation.output_hash = output_hash;
        pending_attestation.evidence_cid = evidence_cid.clone();
        pending_attestation.status = ATTESTATION_STATUS_PENDING;
        pending_attestation.reviewer = Pubkey::default();
        pending_attestation.submitted_at = clock.unix_timestamp;
        pending_attestation.resolved_at = 0;
        pending_attestation.bump = ctx.bumps.pending_attestation;

        registry.pending_attestation_count = registry.pending_attestation_count.saturating_add(1);

        emit!(AttestationSubmitted {
            agent: registry.agent,
            output_hash,
            evidence_cid,
            submitted_at: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn approve_attestation(
        ctx: Context<ApproveAttestation>,
        output_hash: [u8; 32],
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let pending_attestation = &mut ctx.accounts.pending_attestation;
        let clock = Clock::get()?;

        require!(
            pending_attestation.output_hash == output_hash,
            RegistryError::OutputHashMismatch
        );
        require!(
            pending_attestation.status == ATTESTATION_STATUS_PENDING,
            RegistryError::AttestationNotPending
        );
        require!(
            ctx.accounts.reviewer.key() != registry.agent,
            RegistryError::SelfReviewNotAllowed
        );

        let new_score = (registry.reputation_score as u32)
            .saturating_add(VALID_ATTESTATION_REWARD as u32)
            .min(MAX_REPUTATION as u32) as u16;

        registry.reputation_score = new_score;
        registry.last_attested_at = clock.unix_timestamp;
        registry.pending_attestation_count = registry.pending_attestation_count.saturating_sub(1);

        pending_attestation.status = ATTESTATION_STATUS_APPROVED;
        pending_attestation.reviewer = ctx.accounts.reviewer.key();
        pending_attestation.resolved_at = clock.unix_timestamp;

        emit!(AttestationApproved {
            agent: registry.agent,
            reviewer: ctx.accounts.reviewer.key(),
            output_hash,
            new_reputation: new_score,
            approved_at: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn challenge_attestation(
        ctx: Context<ChallengeAttestation>,
        output_hash: [u8; 32],
        violation_hash: [u8; 32],
        evidence_cid: String,
    ) -> Result<()> {
        require!(
            evidence_cid.len() <= ARWEAVE_CID_MAX_LEN,
            RegistryError::EvidenceCidTooLong
        );

        let registry = &mut ctx.accounts.registry;
        let pending_attestation = &mut ctx.accounts.pending_attestation;
        let challenge = &mut ctx.accounts.challenge;
        let clock = Clock::get()?;

        require!(
            pending_attestation.output_hash == output_hash,
            RegistryError::OutputHashMismatch
        );
        require!(
            pending_attestation.status == ATTESTATION_STATUS_PENDING,
            RegistryError::AttestationNotPending
        );
        require!(
            ctx.accounts.reviewer.key() != registry.agent,
            RegistryError::SelfReviewNotAllowed
        );

        let new_score = (registry.reputation_score as u32)
            .saturating_mul(SLASH_REPUTATION_MULTIPLIER as u32)
            / 100;

        registry.reputation_score = new_score as u16;
        registry.slash_count = registry.slash_count.saturating_add(1);
        registry.pending_attestation_count = registry.pending_attestation_count.saturating_sub(1);
        registry.challenged_attestation_count =
            registry.challenged_attestation_count.saturating_add(1);

    pub agent: Pubkey,
    pub capability_hash: [u8; 32],
    pub reputation_score: u16,
    pub slash_count: u8,
    pub arweave_cid: String,
    pub declared_stake: u64,
    pub registered_at: i64,
    pub last_attested_at: i64,
    pub pending_attestation_count: u16,
    pub challenged_attestation_count: u16,
    pub bump: u8,
}

impl RegistryAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1 + (4 + ARWEAVE_CID_MAX_LEN) + 8 + 8 + 8 + 2 + 2 + 1;
}

#[account]
pub struct PendingAttestation {
    pub agent: Pubkey,
    pub output_hash: [u8; 32],
    pub evidence_cid: String,
    pub status: u8,
    pub reviewer: Pubkey,
    pub submitted_at: i64,
    pub resolved_at: i64,
    pub bump: u8,
}

impl PendingAttestation {
    pub const LEN: usize = 8 + 32 + 32 + (4 + ARWEAVE_CID_MAX_LEN) + 1 + 32 + 8 + 8 + 1;
}

#[account]
pub struct ChallengeAccount {
    pub attestation: Pubkey,
    pub challenger: Pubkey,
    pub violation_hash: [u8; 32],
    pub evidence_cid: String,
    pub submitted_at: i64,
    pub bump: u8,
}

impl ChallengeAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + (4 + ARWEAVE_CID_MAX_LEN)
            reviewer: ctx.accounts.reviewer.key(),
            output_hash,
#[instruction(output_hash: [u8; 32], _evidence_cid: String)]
pub struct SubmitAttestation<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, agent.key().as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    #[account(
        init,
        payer = agent,
        space = PendingAttestation::LEN,
        seeds = [PENDING_ATTESTATION_SEED, agent.key().as_ref(), output_hash.as_ref()],
        bump
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(output_hash: [u8; 32])]
pub struct ApproveAttestation<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,

    #[account(
        seeds = [REGISTRY_SEED, reviewer.key().as_ref()],
        bump = reviewer_registry.bump,
    )]
    pub reviewer_registry: Account<'info, RegistryAccount>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    #[account(
        mut,
        seeds = [PENDING_ATTESTATION_SEED, registry.agent.as_ref(), output_hash.as_ref()],
        bump = pending_attestation.bump,
        constraint = pending_attestation.agent == registry.agent @ RegistryError::Unauthorized,
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,
}

#[derive(Accounts)]
#[instruction(output_hash: [u8; 32], _violation_hash: [u8; 32], _evidence_cid: String)]
pub struct ChallengeAttestation<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,

    #[account(
        seeds = [REGISTRY_SEED, reviewer.key().as_ref()],
        bump = reviewer_registry.bump,
    )]
    pub reviewer_registry: Account<'info, RegistryAccount>,

    #[account(
        mut,
        seeds = [REGISTRY_SEED, registry.agent.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    #[account(
        mut,
        seeds = [PENDING_ATTESTATION_SEED, registry.agent.as_ref(), output_hash.as_ref()],
        bump = pending_attestation.bump,
        constraint = pending_attestation.agent == registry.agent @ RegistryError::Unauthorized,
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,

    #[account(
        init,
        payer = reviewer,
        space = ChallengeAccount::LEN,
        seeds = [CHALLENGE_SEED, pending_attestation.key().as_ref()],
        bump
    )]
    pub challenge: Account<'info, ChallengeAccount>,

    pub system_program: Program<'info, System
    }
output_hash: [u8; 32],
    pub evidence_cid: String,
    pub submitted_at: i64,
}

#[event]
pub struct AttestationApproved {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub output_hash: [u8; 32],
    pub new_reputation: u16,
    pub approved_at: i64,
}

#[event]
pub struct AttestationChallenged {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub output_hash: [u8; 32],
    pub challenge: Pubkey,
    pub challengputation: u16,
        min_stake_lamports: u64,
    ) -> Result<bool> {
        let registry = &ctx.accounts.registry;

        let meets_reputation = registry.reputation_score >= min_reputation;
        let meets_stake = registry.declared_stake >= min_stake_lamports;
        let not_banned = registry.slash_count < 3;

        let trusted = meets_reputation && meets_stake && not_banned;

        let result = &mut ctx.accounts.verify_result;
        result.agent = registry.agent;
        result.trusted = trusted;
        result.checked_at = Clock::get()?.unix_timestamp;
        result.bump = ctx.bumps.verify_result;

        emit!(AgentVerified {
            agent: registry.agent,
            caller: ctx.accounts.caller.key(),
            trusted,
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

        let new_score = (registry.reputation_score as u32)
            .saturating_mul(SLASH_REPUTATION_MULTIPLIER as u32)
            / 100;

        registry.reputation_score = new_score as u16;
        registry.slash_count = registry.slash_count.saturating_add(1);

        emit!(AgentSlashed {
            agent: registry.agent,
            slash_count: registry.slash_count,
            new_reputation: registry.reputation_score,
            slashed_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn update_declared_stake(
        ctx: Context<UpdateDeclaredStake>,
        stake_lamports: u64,
    ) -> Result<()> {
        ctx.accounts.registry.declared_stake = stake_lamports;
        Ok(())
    }
}

#[account]
#[derive(Default)]
pub struct RegistryAccount {
    pub operator: Pubkey,          // 32
    pub agent: Pubkey,             // 32
    pub capability_hash: [u8; 32], // 32  — immutable after registration
    pub reputation_score: u16,     // 2   — 0–10000
    pub slash_count: u8,           // 1   — permanent, never resets
    pub arweave_cid: String,       // 4 + ARWEAVE_CID_MAX_LEN
    pub declared_stake: u64,       // 8   — synced from dolores_fund
    pub registered_at: i64,        // 8
    pub last_attested_at: i64,     // 8
    pub bump: u8,                  // 1
}

impl RegistryAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1 + (4 + ARWEAVE_CID_MAX_LEN) + 8 + 8 + 8 + 1;
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

    pub sysArweave CID exceeds maximum length of 64 bytes")]
    CidTooLong,
    #[msg("Evidence CID exceeds maximum length of 64 bytes")]
    EvidenceCidTooLong,
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
    #[msg("Pending attestation is not in a reviewable state")]
    AttestationNotPending,
    #[msg("Reviewer cannot review their own work")]
    SelfReviewNotAllowed,
    #[msg("Provided output hash does not match the pending attestation")]
    OutputHashMismatch,
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
        constraint = registry.operator == slash_authority.key() @ RegistryError::Unauthorized
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
    pub new_reputation: u16,
    pub attested_at: i64,
}

#[event]
pub struct AgentVerified {
    pub agent: Pubkey,
    pub caller: Pubkey,
    pub trusted: bool,
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
    pub new_reputation: u16,
    pub slashed_at: i64,
}

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
}

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
