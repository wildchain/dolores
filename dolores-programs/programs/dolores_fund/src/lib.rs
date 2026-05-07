use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Ft8uiLucHyK58rU77ph7NApwepxSUqonRkfnhe4JjpWY");

pub const FUND_SEED: &[u8] = b"fund";
pub const STAKER_SEED: &[u8] = b"staker";
pub const VAULT_SEED: &[u8] = b"vault";

/// Reward epoch — 7 days in seconds
pub const REWARD_EPOCH_SECS: i64 = 7 * 24 * 60 * 60;

/// Minimum stake — 0.01 SOL in lamports
pub const MIN_STAKE_LAMPORTS: u64 = 10_000_000;

/// Slash split — 60% to challenger, 40% to treasury
pub const SLASH_CHALLENGER_BPS: u64 = 6_000;
pub const SLASH_TREASURY_BPS: u64 = 4_000;
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod dolores_fund {
    use super::*;

    /// Initialise a FundAccount for an (operator, agent) pair.
    /// Called once per agent during registration flow.
    /// The vault PDA is a system account that holds the actual SOL.
    pub fn initialize_fund(ctx: Context<InitializeFund>) -> Result<()> {
        let fund = &mut ctx.accounts.fund;
        let clock = Clock::get()?;

        fund.operator = ctx.accounts.operator.key();
        fund.agent = ctx.accounts.agent.key();
        fund.vault = ctx.accounts.vault.key();
        fund.total_locked_stake = 0;
        fund.validator_stake = 0;
        fund.community_stake = 0;
        fund.staker_count = 0;
        fund.accumulated_rewards = 0;
        fund.last_reward_epoch = clock.unix_timestamp;
        fund.bump = ctx.bumps.fund;
        fund.vault_bump = ctx.bumps.vault;

        emit!(FundInitialized {
            operator: fund.operator,
            agent: fund.agent,
            fund: ctx.accounts.fund.key(),
        });

        Ok(())
    }

    /// Operator stakes SOL as the validator stake.
    /// This is the primary stake — slashing hits this first.
    pub fn stake(ctx: Context<Stake>, amount_lamports: u64) -> Result<()> {
        require!(
            amount_lamports >= MIN_STAKE_LAMPORTS,
            FundError::StakeBelowMinimum
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.operator.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount_lamports)?;

        //  capture keys BEFORE mutable borrow
        let fund_key = ctx.accounts.fund.key();
        let operator_key = ctx.accounts.operator.key();
        let program_id = ctx.program_id;

        let fund = &mut ctx.accounts.fund;
        fund.validator_stake = fund.validator_stake.saturating_add(amount_lamports);
        fund.total_locked_stake = fund.total_locked_stake.saturating_add(amount_lamports);

        let staker = &mut ctx.accounts.staker_position;
        if staker.amount_staked == 0 {
            fund.staker_count = fund.staker_count.saturating_add(1);
            staker.fund = fund_key;
            staker.staker = operator_key;
            staker.is_validator = true;
            staker.staked_at = Clock::get()?.unix_timestamp;
            staker.last_claim_ts = Clock::get()?.unix_timestamp;
            let (_, bump) = Pubkey::find_program_address(
                &[STAKER_SEED, fund_key.as_ref(), operator_key.as_ref()],
                program_id,
            );
            staker.bump = bump;
        }
        staker.amount_staked = staker.amount_staked.saturating_add(amount_lamports);

        emit!(Staked {
            staker: operator_key,
            agent: fund.agent,
            amount: amount_lamports,
            total_locked: fund.total_locked_stake,
            is_validator: true,
        });

        Ok(())
    }

    pub fn community_stake(ctx: Context<CommunityStake>, amount_lamports: u64) -> Result<()> {
        require!(
            amount_lamports >= MIN_STAKE_LAMPORTS,
            FundError::StakeBelowMinimum
        );

        require!(
            ctx.accounts.staker.key() != ctx.accounts.fund.operator,
            FundError::OperatorMustUseStake
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.staker.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount_lamports)?;

        let fund_key = ctx.accounts.fund.key();
        let staker_key = ctx.accounts.staker.key();
        let program_id = ctx.program_id;

        let fund = &mut ctx.accounts.fund;
        fund.community_stake = fund.community_stake.saturating_add(amount_lamports);
        fund.total_locked_stake = fund.total_locked_stake.saturating_add(amount_lamports);

        let staker_pos = &mut ctx.accounts.staker_position;
        if staker_pos.amount_staked == 0 {
            fund.staker_count = fund.staker_count.saturating_add(1);
            staker_pos.fund = fund_key;
            staker_pos.staker = staker_key;
            staker_pos.is_validator = false;
            staker_pos.staked_at = Clock::get()?.unix_timestamp;
            staker_pos.last_claim_ts = Clock::get()?.unix_timestamp;
            let (_, bump) = Pubkey::find_program_address(
                &[STAKER_SEED, fund_key.as_ref(), staker_key.as_ref()],
                program_id,
            );
            staker_pos.bump = bump;
        }
        staker_pos.amount_staked = staker_pos.amount_staked.saturating_add(amount_lamports);

        emit!(Staked {
            staker: staker_key,
            agent: fund.agent,
            amount: amount_lamports,
            total_locked: fund.total_locked_stake,
            is_validator: false,
        });

        Ok(())
    }
    /// Partial withdrawals supported — cannot go below zero.
    pub fn withdraw_stake(ctx: Context<WithdrawStake>, amount_lamports: u64) -> Result<()> {
        require!(
            !ctx.accounts.fund.challenge_active,
            FundError::WithdrawLockedDuringChallenge
        );

        let staker_pos = &mut ctx.accounts.staker_position;
        require!(
            staker_pos.amount_staked >= amount_lamports,
            FundError::InsufficientStake
        );

        let fund = &mut ctx.accounts.fund;

        // Update fund totals
        if staker_pos.is_validator {
            fund.validator_stake = fund.validator_stake.saturating_sub(amount_lamports);
        } else {
            fund.community_stake = fund.community_stake.saturating_sub(amount_lamports);
        }
        fund.total_locked_stake = fund.total_locked_stake.saturating_sub(amount_lamports);

        staker_pos.amount_staked = staker_pos.amount_staked.saturating_sub(amount_lamports);

        if staker_pos.amount_staked == 0 {
            fund.staker_count = fund.staker_count.saturating_sub(1);
        }

        // Transfer SOL from vault back to staker
        // Vault is a PDA — use seeds to sign
        let agent_key = fund.agent.key();
        let operator_key = fund.operator.key();
        let vault_seeds: &[&[u8]] = &[
            VAULT_SEED,
            operator_key.as_ref(),
            agent_key.as_ref(),
            &[fund.vault_bump],
        ];
        let signer_seeds = &[vault_seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.staker_wallet.to_account_info(),
            },
            signer_seeds,
        );
        system_program::transfer(cpi_ctx, amount_lamports)?;

        emit!(Unstaked {
            staker: ctx.accounts.staker_wallet.key(),
            agent: fund.agent,
            amount: amount_lamports,
            total_locked: fund.total_locked_stake,
        });

        Ok(())
    }

    /// Deposit rewards into the fund for distribution.
    /// Called when a task subscription fee is paid.
    /// In production this is called by the task registration flow.
    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, FundError::ZeroAmount);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount_lamports)?;

        ctx.accounts.fund.accumulated_rewards = ctx
            .accounts
            .fund
            .accumulated_rewards
            .saturating_add(amount_lamports);

        Ok(())
    }

    /// Claim proportional rewards for a staker.
    /// Rewards are proportional to (staker_amount / total_locked_stake).
    /// Can only claim once per epoch (7 days).
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let clock = Clock::get()?;
        let fund = &mut ctx.accounts.fund;
        let staker_pos = &mut ctx.accounts.staker_position;

        // Enforce epoch cooldown
        require!(
            clock.unix_timestamp >= staker_pos.last_claim_ts + REWARD_EPOCH_SECS,
            FundError::EpochNotComplete
        );

        require!(fund.total_locked_stake > 0, FundError::NoStakeInFund);
        require!(fund.accumulated_rewards > 0, FundError::NoRewardsAvailable);

        // Proportional reward: (staker_amount / total_locked) * accumulated_rewards
        // Use u128 to avoid overflow
        let reward = (staker_pos.amount_staked as u128)
            .saturating_mul(fund.accumulated_rewards as u128)
            / (fund.total_locked_stake as u128);
        let reward = reward as u64;

        require!(reward > 0, FundError::NoRewardsAvailable);

        fund.accumulated_rewards = fund.accumulated_rewards.saturating_sub(reward);
        staker_pos.last_claim_ts = clock.unix_timestamp;
        staker_pos.total_claimed = staker_pos.total_claimed.saturating_add(reward);

        // Transfer from vault to staker
        let agent_key = fund.agent.key();
        let operator_key = fund.operator.key();
        let vault_seeds: &[&[u8]] = &[
            VAULT_SEED,
            operator_key.as_ref(),
            agent_key.as_ref(),
            &[fund.vault_bump],
        ];
        let signer_seeds = &[vault_seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.staker_wallet.to_account_info(),
            },
            signer_seeds,
        );
        system_program::transfer(cpi_ctx, reward)?;

        emit!(RewardsClaimed {
            staker: ctx.accounts.staker_wallet.key(),
            agent: fund.agent,
            amount: reward,
        });

        Ok(())
    }

    /// Execute a slash. Called by dolores_adjudication via CPI.
    /// Splits the slashed amount: 60% to challenger, 40% to treasury.
    /// All StakerPosition balances reduce proportionally on their next interaction
    /// (lazy accounting — avoids iterating all stakers on-chain).
    pub fn execute_slash(ctx: Context<ExecuteSlash>, slash_amount_lamports: u64) -> Result<()> {
        let fund = &mut ctx.accounts.fund;

        require!(
            fund.total_locked_stake >= slash_amount_lamports,
            FundError::InsufficientStake
        );

        let slash_ratio_bps = (slash_amount_lamports as u128)
            .saturating_mul(BPS_DENOMINATOR as u128)
            / (fund.total_locked_stake as u128);

        // Update accounting only — no SOL transfer here
        // Challenger claims their share via claim_slash_reward()
        fund.total_locked_stake = fund
            .total_locked_stake
            .saturating_sub(slash_amount_lamports);
        fund.validator_stake = fund
            .validator_stake
            .saturating_mul(BPS_DENOMINATOR - slash_ratio_bps as u64)
            / BPS_DENOMINATOR;
        fund.community_stake = fund
            .community_stake
            .saturating_mul(BPS_DENOMINATOR - slash_ratio_bps as u64)
            / BPS_DENOMINATOR;
        fund.challenge_active = false;
        fund.last_slash_ratio_bps = slash_ratio_bps as u16;
        fund.pending_slash_challenger = ctx.accounts.challenger.key();
        fund.pending_slash_amount = slash_amount_lamports;

        emit!(SlashExecuted {
            agent: fund.agent,
            slash_amount: slash_amount_lamports,
            challenger_share: slash_amount_lamports * SLASH_CHALLENGER_BPS / BPS_DENOMINATOR,
            treasury_share: slash_amount_lamports * SLASH_TREASURY_BPS / BPS_DENOMINATOR,
            remaining_stake: fund.total_locked_stake,
            slash_ratio_bps: slash_ratio_bps as u16,
        });

        Ok(())
    }
    /// Lock fund during an active challenge.
    /// Called by dolores_adjudication when file_challenge() fires.
    pub fn lock_fund(ctx: Context<LockFund>) -> Result<()> {
        ctx.accounts.fund.challenge_active = true;
        Ok(())
    }

    /// Unlock fund when a challenge is dismissed.
    pub fn unlock_fund(ctx: Context<UnlockFund>) -> Result<()> {
        ctx.accounts.fund.challenge_active = false;
        Ok(())
    }

    /// Apply the last slash ratio to a staker's position.
    /// Called lazily when a staker tries to withdraw or claim after a slash.
    pub fn apply_slash_to_staker(ctx: Context<ApplySlashToStaker>) -> Result<()> {
        let fund = &ctx.accounts.fund;
        let staker_pos = &mut ctx.accounts.staker_position;

        if fund.last_slash_ratio_bps > 0 && !staker_pos.slash_applied {
            staker_pos.amount_staked = staker_pos
                .amount_staked
                .saturating_mul((BPS_DENOMINATOR - fund.last_slash_ratio_bps as u64) as u64)
                / BPS_DENOMINATOR;
            staker_pos.slash_applied = true;
        }

        Ok(())
    }
}

// ────────────────────────────────────────────────────────────
// Accounts
// ────────────────────────────────────────────────────────────

/// One FundAccount per (operator, agent) pair.
/// Seeds: [FUND_SEED, operator.pubkey, agent.pubkey]
#[account]
#[derive(Default)]
pub struct FundAccount {
    pub operator: Pubkey,          // 32
    pub agent: Pubkey,             // 32
    pub vault: Pubkey,             // 32 — vault PDA that holds SOL
    pub total_locked_stake: u64,   // 8
    pub validator_stake: u64,      // 8
    pub community_stake: u64,      // 8
    pub accumulated_rewards: u64,  // 8
    pub staker_count: u16,         // 2
    pub last_reward_epoch: i64,    // 8
    pub challenge_active: bool,    // 1
    pub last_slash_ratio_bps: u16, // 2 — used for lazy staker balance reduction
    pub bump: u8,                  // 1
    pub vault_bump: u8,            // 1
    pub pending_slash_challenger: Pubkey,
    pub pending_slash_amount: u64, // 8
}

impl FundAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 8 + 1 + 2 + 1 + 1 + 32 + 8;
}

/// One StakerPosition per (fund, staker).
/// Seeds: [STAKER_SEED, fund.pubkey, staker.pubkey]
#[account]
#[derive(Default)]
pub struct StakerPosition {
    pub fund: Pubkey,        // 32
    pub staker: Pubkey,      // 32
    pub amount_staked: u64,  // 8
    pub total_claimed: u64,  // 8
    pub staked_at: i64,      // 8
    pub last_claim_ts: i64,  // 8
    pub is_validator: bool,  // 1
    pub slash_applied: bool, // 1 — whether last slash has been applied
    pub bump: u8,            // 1
}

impl StakerPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[derive(Accounts)]
pub struct InitializeFund<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    /// CHECK: agent pubkey used as seed only
    pub agent: AccountInfo<'info>,

    #[account(
        init,
        payer  = operator,
        space  = FundAccount::LEN,
        seeds  = [FUND_SEED, operator.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    pub fund: Account<'info, FundAccount>,

    /// Vault PDA that holds actual SOL — no data, just lamports
    #[account(
        init,
        payer  = operator,
        space  = 0,
        seeds  = [VAULT_SEED, operator.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    /// CHECK: vault is a system account PDA used only to hold SOL
    pub vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, operator.key().as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
        constraint = fund.operator == operator.key() @ FundError::Unauthorized
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, operator.key().as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer  = operator,
        space  = StakerPosition::LEN,
        seeds  = [STAKER_SEED, fund.key().as_ref(), operator.key().as_ref()],
        bump
    )]
    pub staker_position: Account<'info, StakerPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CommunityStake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer  = staker,
        space  = StakerPosition::LEN,
        seeds  = [STAKER_SEED, fund.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub staker_position: Account<'info, StakerPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    pub staker_wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [STAKER_SEED, fund.key().as_ref(), staker_wallet.key().as_ref()],
        bump  = staker_position.bump,
        constraint = staker_position.staker == staker_wallet.key() @ FundError::Unauthorized
    )]
    pub staker_position: Account<'info, StakerPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    pub staker_wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [STAKER_SEED, fund.key().as_ref(), staker_wallet.key().as_ref()],
        bump  = staker_position.bump,
        constraint = staker_position.staker == staker_wallet.key() @ FundError::Unauthorized
    )]
    pub staker_position: Account<'info, StakerPosition>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteSlash<'info> {
    /// TODO production: constrain to dolores_adjudication program PDA only
    pub slash_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.vault_bump
    )]
    /// CHECK: vault PDA holds SOL
    pub vault: AccountInfo<'info>,

    /// CHECK: challenger receives 60% of slash
    #[account(mut)]
    pub challenger: AccountInfo<'info>,

    /// CHECK: treasury receives 40% of slash
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockFund<'info> {
    /// TODO production: constrain to dolores_adjudication program PDA only
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,
}

#[derive(Accounts)]
pub struct UnlockFund<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,
}

#[derive(Accounts)]
pub struct ApplySlashToStaker<'info> {
    #[account(
        seeds = [FUND_SEED, fund.operator.as_ref(), fund.agent.as_ref()],
        bump  = fund.bump,
    )]
    pub fund: Account<'info, FundAccount>,

    #[account(
        mut,
        seeds = [STAKER_SEED, fund.key().as_ref(), staker_position.staker.as_ref()],
        bump  = staker_position.bump,
    )]
    pub staker_position: Account<'info, StakerPosition>,
}

// ────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────

#[event]
pub struct FundInitialized {
    pub operator: Pubkey,
    pub agent: Pubkey,
    pub fund: Pubkey,
}

#[event]
pub struct Staked {
    pub staker: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
    pub total_locked: u64,
    pub is_validator: bool,
}

#[event]
pub struct Unstaked {
    pub staker: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
    pub total_locked: u64,
}

#[event]
pub struct RewardsClaimed {
    pub staker: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SlashExecuted {
    pub agent: Pubkey,
    pub slash_amount: u64,
    pub challenger_share: u64,
    pub treasury_share: u64,
    pub remaining_stake: u64,
    pub slash_ratio_bps: u16,
}

#[error_code]
pub enum FundError {
    #[msg("Stake amount is below the minimum required")]
    StakeBelowMinimum,
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
    #[msg("Cannot withdraw while an active challenge is pending")]
    WithdrawLockedDuringChallenge,
    #[msg("Insufficient staked amount for this operation")]
    InsufficientStake,
    #[msg("Reward epoch has not completed yet — wait 7 days between claims")]
    EpochNotComplete,
    #[msg("No stake in fund")]
    NoStakeInFund,
    #[msg("No rewards available to claim")]
    NoRewardsAvailable,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Operator must use stake() not community_stake()")]
    OperatorMustUseStake,
}
