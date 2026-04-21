use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;

declare_id!("4BPrSgzHJK1GzE5dYDsscKvgNRRiDzzq2WvPHHzLyAbz");

pub const TASK_SEED: &[u8] = b"task";
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const AUTHORITY_SEED: &[u8] = b"authority";

pub const MIN_BOND_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const DEFAULT_SLASH_LAMPORTS: u64 = 100_000_000; // 0.1 SOL

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum FailureType {
    MissedDeadline,
    OutOfScopeCall,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Pending,
    Completed,
    Challenged,
    Slashed,
    Dismissed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChallengeStatus {
    Filed,
    Resolved,
    Dismissed,
}

fn ix_discriminator(name: &str) -> [u8; 8] {
    let preimage = format!("global:{}", name);
    let hash = anchor_lang::solana_program::hash::hash(preimage.as_bytes());
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash.to_bytes()[..8]);
    disc
}

fn build_lock_fund_ix(fund_program_id: &Pubkey, authority: &Pubkey, fund: &Pubkey) -> Instruction {
    let mut data = ix_discriminator("lock_fund").to_vec();
    // lock_fund takes no args — discriminator only
    let _ = data;
    Instruction {
        program_id: *fund_program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*fund, false),
        ],
        data: ix_discriminator("lock_fund").to_vec(),
    }
}

fn build_unlock_fund_ix(
    fund_program_id: &Pubkey,
    authority: &Pubkey,
    fund: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: *fund_program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*fund, false),
        ],
        data: ix_discriminator("unlock_fund").to_vec(),
    }
}

fn build_execute_slash_ix(
    fund_program_id: &Pubkey,
    slash_authority: &Pubkey,
    fund: &Pubkey,
    vault: &Pubkey,
    challenger: &Pubkey,
    treasury: &Pubkey,
    slash_amount_lamports: u64,
) -> Instruction {
    let mut data = ix_discriminator("execute_slash").to_vec();
    data.extend_from_slice(&slash_amount_lamports.to_le_bytes());
    Instruction {
        program_id: *fund_program_id,
        accounts: vec![
            AccountMeta::new_readonly(*slash_authority, true),
            AccountMeta::new(*fund, false),
            AccountMeta::new(*vault, false),
            AccountMeta::new(*challenger, false),
            AccountMeta::new(*treasury, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }
}

fn build_record_slash_ix(
    registry_program_id: &Pubkey,
    slash_authority: &Pubkey,
    registry: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: *registry_program_id,
        accounts: vec![
            AccountMeta::new_readonly(*slash_authority, true),
            AccountMeta::new(*registry, false),
        ],
        data: ix_discriminator("record_slash").to_vec(),
    }
}

#[program]
pub mod dolores_adjudication {
    use super::*;

    /// Register a task when a user hires an agent.
    /// Locks the deadline on-chain — ground truth for challenge resolution.
    pub fn register_task(
        ctx: Context<RegisterTask>,
        task_id: [u8; 32],
        deadline: i64,
        output_hash: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(deadline > clock.unix_timestamp, AdjError::DeadlineInPast);

        let task = &mut ctx.accounts.task_record;
        task.agent = ctx.accounts.agent.key();
        task.assigned_by = ctx.accounts.user.key();
        task.task_id = task_id;
        task.output_hash = output_hash;
        task.deadline = deadline;
        task.status = TaskStatus::Pending;
        task.created_at = clock.unix_timestamp;
        task.completed_at = None;
        task.bump = ctx.bumps.task_record;

        emit!(TaskRegistered {
            task_id,
            agent: task.agent,
            assigned_by: task.assigned_by,
            deadline,
            created_at: task.created_at,
        });

        Ok(())
    }

    /// Mark a task as completed. Only the agent can call this.
    pub fn complete_task(ctx: Context<CompleteTask>, output_hash: [u8; 32]) -> Result<()> {
        let clock = Clock::get()?;
        let task = &mut ctx.accounts.task_record;

        require!(task.status == TaskStatus::Pending, AdjError::TaskNotPending);
        require!(
            ctx.accounts.agent.key() == task.agent,
            AdjError::Unauthorized
        );

        task.output_hash = output_hash;
        task.status = TaskStatus::Completed;
        task.completed_at = Some(clock.unix_timestamp);

        emit!(TaskCompleted {
            task_id: task.task_id,
            agent: task.agent,
            output_hash,
            completed_at: clock.unix_timestamp,
        });

        Ok(())
    }

    /// File a challenge. Locks the fund via CPI to dolores_fund.
    pub fn file_challenge(
        ctx: Context<FileChallenge>,
        failure_type: FailureType,
        proof_data: Vec<u8>,
    ) -> Result<()> {
        require!(proof_data.len() <= 1024, AdjError::ProofDataTooLarge);

        let clock = Clock::get()?;

        // Capture keys before mutable borrows
        let task_agent = ctx.accounts.task_record.agent;
        let task_id = ctx.accounts.task_record.task_id;
        let task_status = ctx.accounts.task_record.status.clone();

        require!(
            task_status == TaskStatus::Pending || task_status == TaskStatus::Completed,
            AdjError::TaskNotChallengeable
        );
        require!(
            ctx.accounts.challenger.key() != task_agent,
            AdjError::AgentCannotChallenge
        );

        // Fill challenge account
        let challenge = &mut ctx.accounts.challenge;
        challenge.agent = task_agent;
        challenge.task_id = task_id;
        challenge.challenger = ctx.accounts.challenger.key();
        challenge.bond_amount = MIN_BOND_LAMPORTS;
        challenge.failure_type = failure_type;
        challenge.proof_data = proof_data;
        challenge.status = ChallengeStatus::Filed;
        challenge.filed_at = clock.unix_timestamp;
        challenge.bump = ctx.bumps.challenge;

        // Update task status
        ctx.accounts.task_record.status = TaskStatus::Challenged;

        // CPI → dolores_fund: lock_fund()
        let authority_bump = ctx.bumps.adjudication_authority;
        let authority_seeds: &[&[u8]] = &[AUTHORITY_SEED, &[authority_bump]];
        let signer_seeds = &[authority_seeds];

        let ix = build_lock_fund_ix(
            &ctx.accounts.fund_program.key(),
            &ctx.accounts.adjudication_authority.key(),
            &ctx.accounts.fund_account.key(),
        );
        invoke_signed(
            &ix,
            &[
                ctx.accounts.adjudication_authority.to_account_info(),
                ctx.accounts.fund_account.to_account_info(),
            ],
            signer_seeds,
        )?;

        emit!(ChallengeFiledEvent {
            task_id,
            agent: task_agent,
            challenger: ctx.accounts.challenger.key(),
            failure_type: challenge.failure_type.clone(),
            filed_at: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Auto-adjudicate on-chain. No humans involved.
    /// Valid proof → slash agent. Invalid proof → dismiss challenge.
    pub fn auto_adjudicate(ctx: Context<AutoAdjudicate>) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            ctx.accounts.challenge.status == ChallengeStatus::Filed,
            AdjError::ChallengeAlreadyResolved
        );
        require!(
            ctx.accounts.challenge.task_id == ctx.accounts.task_record.task_id,
            AdjError::TaskChallengeMismatch
        );
        require!(
            ctx.accounts.challenge.agent == ctx.accounts.task_record.agent,
            AdjError::TaskChallengeMismatch
        );

        // Capture all values we need before any mutable borrows
        let failure_type = ctx.accounts.challenge.failure_type.clone();
        let proof_data = ctx.accounts.challenge.proof_data.clone();
        let task_completed_at = ctx.accounts.task_record.completed_at;
        let task_deadline = ctx.accounts.task_record.deadline;
        let task_id = ctx.accounts.task_record.task_id;
        let agent = ctx.accounts.task_record.agent;
        let challenger_key = ctx.accounts.challenge.challenger;
        let authority_bump = ctx.bumps.adjudication_authority;

        let valid_proof = match failure_type {
            FailureType::MissedDeadline => {
                let missed =
                    task_completed_at.is_none() || task_completed_at.unwrap() > task_deadline;
                let deadline_passed = clock.unix_timestamp > task_deadline;
                missed && deadline_passed
            }
            FailureType::OutOfScopeCall => {
                // Non-empty proof accepted — full manifest verification is a TODO
                !proof_data.is_empty()
            }
        };

        let authority_seeds: &[&[u8]] = &[AUTHORITY_SEED, &[authority_bump]];
        let signer_seeds = &[authority_seeds];

        if valid_proof {
            // Slash path

            // CPI → dolores_fund: execute_slash()
            let ix = build_execute_slash_ix(
                &ctx.accounts.fund_program.key(),
                &ctx.accounts.adjudication_authority.key(),
                &ctx.accounts.fund_account.key(),
                &ctx.accounts.vault.key(),
                &ctx.accounts.challenger.key(),
                &ctx.accounts.treasury.key(),
                DEFAULT_SLASH_LAMPORTS,
            );
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.adjudication_authority.to_account_info(),
                    ctx.accounts.fund_account.to_account_info(),
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.challenger.to_account_info(),
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;

            // CPI → dolores_registry: record_slash()
            let ix = build_record_slash_ix(
                &ctx.accounts.registry_program.key(),
                &ctx.accounts.adjudication_authority.key(),
                &ctx.accounts.registry.key(),
            );
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.adjudication_authority.to_account_info(),
                    ctx.accounts.registry.to_account_info(),
                ],
                signer_seeds,
            )?;

            // Update statuses after CPIs
            ctx.accounts.challenge.status = ChallengeStatus::Resolved;
            ctx.accounts.task_record.status = TaskStatus::Slashed;

            emit!(AgentSlashedEvent {
                task_id,
                agent,
                challenger: challenger_key,
                failure_type: ctx.accounts.challenge.failure_type.clone(),
                slashed_at: clock.unix_timestamp,
            });
        } else {
            // Dismiss path

            // CPI → dolores_fund: unlock_fund()
            let ix = build_unlock_fund_ix(
                &ctx.accounts.fund_program.key(),
                &ctx.accounts.adjudication_authority.key(),
                &ctx.accounts.fund_account.key(),
            );
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.adjudication_authority.to_account_info(),
                    ctx.accounts.fund_account.to_account_info(),
                ],
                signer_seeds,
            )?;

            ctx.accounts.challenge.status = ChallengeStatus::Dismissed;
            ctx.accounts.task_record.status = TaskStatus::Dismissed;

            emit!(ChallengeDismissedEvent {
                task_id,
                agent,
                challenger: challenger_key,
            });
        }

        Ok(())
    }
}

#[account]
pub struct TaskRecord {
    pub agent: Pubkey,             // 32
    pub assigned_by: Pubkey,       // 32
    pub task_id: [u8; 32],         // 32
    pub output_hash: [u8; 32],     // 32
    pub deadline: i64,             // 8
    pub status: TaskStatus,        // 1
    pub created_at: i64,           // 8
    pub completed_at: Option<i64>, // 9
    pub bump: u8,                  // 1
}

impl TaskRecord {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 1 + 8 + 9 + 1;
}

#[account]
pub struct Challenge {
    pub agent: Pubkey,             // 32
    pub task_id: [u8; 32],         // 32
    pub challenger: Pubkey,        // 32
    pub bond_amount: u64,          // 8
    pub failure_type: FailureType, // 1
    pub proof_data: Vec<u8>,       // 4 + 1024
    pub status: ChallengeStatus,   // 1
    pub filed_at: i64,             // 8
    pub bump: u8,                  // 1
}

impl Challenge {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 1 + (4 + 1024) + 1 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(task_id: [u8; 32], deadline: i64, output_hash: [u8; 32])]
pub struct RegisterTask<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: agent pubkey used as PDA seed
    pub agent: AccountInfo<'info>,

    #[account(
        init,
        payer = user,
        space = TaskRecord::LEN,
        seeds = [TASK_SEED, agent.key().as_ref(), task_id.as_ref()],
        bump
    )]
    pub task_record: Account<'info, TaskRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, agent.key().as_ref(), task_record.task_id.as_ref()],
        bump  = task_record.bump,
        constraint = task_record.agent == agent.key() @ AdjError::Unauthorized
    )]
    pub task_record: Account<'info, TaskRecord>,
}

#[derive(Accounts)]
pub struct FileChallenge<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, task_record.agent.as_ref(), task_record.task_id.as_ref()],
        bump  = task_record.bump,
    )]
    pub task_record: Account<'info, TaskRecord>,

    #[account(
        init,
        payer  = challenger,
        space  = Challenge::LEN,
        seeds  = [CHALLENGE_SEED, task_record.agent.as_ref(), task_record.task_id.as_ref()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        seeds = [AUTHORITY_SEED],
        bump
    )]
    /// CHECK: PDA used as CPI signer
    pub adjudication_authority: AccountInfo<'info>,

    /// CHECK: FundAccount for the challenged agent
    #[account(mut)]
    pub fund_account: AccountInfo<'info>,

    /// CHECK: dolores_fund program
    pub fund_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AutoAdjudicate<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, task_record.agent.as_ref(), task_record.task_id.as_ref()],
        bump  = task_record.bump,
    )]
    pub task_record: Account<'info, TaskRecord>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, challenge.agent.as_ref(), challenge.task_id.as_ref()],
        bump  = challenge.bump,
        constraint = challenge.task_id == task_record.task_id @ AdjError::TaskChallengeMismatch
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        seeds = [AUTHORITY_SEED],
        bump
    )]
    /// CHECK: PDA used as CPI signer
    pub adjudication_authority: AccountInfo<'info>,

    /// CHECK: FundAccount for the agent
    #[account(mut)]
    pub fund_account: AccountInfo<'info>,

    /// CHECK: vault PDA inside dolores_fund
    #[account(mut)]
    pub vault: AccountInfo<'info>,

    /// CHECK: challenger wallet — receives slash reward
    #[account(mut)]
    pub challenger: AccountInfo<'info>,

    /// CHECK: treasury wallet
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: RegistryAccount for the agent
    #[account(mut)]
    pub registry: AccountInfo<'info>,

    /// CHECK: dolores_fund program
    pub fund_program: AccountInfo<'info>,

    /// CHECK: dolores_registry program
    pub registry_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct TaskRegistered {
    pub task_id: [u8; 32],
    pub agent: Pubkey,
    pub assigned_by: Pubkey,
    pub deadline: i64,
    pub created_at: i64,
}

#[event]
pub struct TaskCompleted {
    pub task_id: [u8; 32],
    pub agent: Pubkey,
    pub output_hash: [u8; 32],
    pub completed_at: i64,
}

#[event]
pub struct ChallengeFiledEvent {
    pub task_id: [u8; 32],
    pub agent: Pubkey,
    pub challenger: Pubkey,
    pub failure_type: FailureType,
    pub filed_at: i64,
}

#[event]
pub struct AgentSlashedEvent {
    pub task_id: [u8; 32],
    pub agent: Pubkey,
    pub challenger: Pubkey,
    pub failure_type: FailureType,
    pub slashed_at: i64,
}

#[event]
pub struct ChallengeDismissedEvent {
    pub task_id: [u8; 32],
    pub agent: Pubkey,
    pub challenger: Pubkey,
}

#[error_code]
pub enum AdjError {
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Task is not in pending state")]
    TaskNotPending,
    #[msg("Task cannot be challenged in its current state")]
    TaskNotChallengeable,
    #[msg("Challenge has already been resolved")]
    ChallengeAlreadyResolved,
    #[msg("Task and challenge agent/task_id do not match")]
    TaskChallengeMismatch,
    #[msg("Agent cannot challenge their own task")]
    AgentCannotChallenge,
    #[msg("Challenger bond is below minimum required")]
    BondTooLow,
    #[msg("Proof data exceeds maximum size of 1024 bytes")]
    ProofDataTooLarge,
    #[msg("Caller is not authorized")]
    Unauthorized,
}
