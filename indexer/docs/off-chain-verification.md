# Off-Chain Verification Node Documentation

This document describes how verification nodes validate trading agent operations by fetching on-chain data, applying verification rules, and generating cryptographic proofs for challenges.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Verification Node Workflow                                  │
├──────────────────────────────────────────────────────────────┤
│  1. Monitor new receipts (Arweave uploads or event logs)     │
│  2. Fetch transaction data from Solana RPC                   │
│  3. Parse instructions, account changes, token balances      │
│  4. Query oracles and protocol state (prices, pools, etc.)   │
│  5. Apply verification rules from operation.rules.json       │
│  6. Calculate metrics (slippage, PnL, collateral ratio)      │
│  7. Generate Merkle proof if violation detected              │
│  8. Submit challenge + proof to on-chain adjudication        │
└──────────────────────────────────────────────────────────────┘
```

## Data Sources

### Primary Sources

- **Solana RPC** - Transaction data, account states, block timestamps
- **Price Oracles** - Pyth, Switchboard for token prices
- **Protocol Accounts** - Pool states, lending positions, staking balances
- **Arweave** - Full execution receipts uploaded by agents

### RPC Methods Used

```typescript
// Fetch transaction with full metadata
connection.getTransaction(signature, {
  maxSupportedTransactionVersion: 0,
  commitment: 'confirmed',
});

// Fetch account state at specific time
connection.getAccountInfo(pubkey);

// Parse transaction instructions
connection.getParsedTransaction(signature);

// Get block for timestamp verification
connection.getBlock(slot);
```

---

## Operation-Specific Verification

### 1. SWAP

#### Verifiable Properties

**1.1 Slippage tolerance not exceeded**

**Data Collection:**

```typescript
async function verifySlippage(receipt: ExecutionReceipt) {
  // Fetch actual transaction
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Extract token account changes
  const preBalances = tx.meta.preTokenBalances;
  const postBalances = tx.meta.postTokenBalances;

  // Find input/output token changes
  const inputDelta = findTokenDelta(
    preBalances,
    postBalances,
    receipt.swap_details.input_token,
  );
  const outputDelta = findTokenDelta(
    preBalances,
    postBalances,
    receipt.swap_details.output_token,
  );

  return { inputDelta, outputDelta };
}
```

**Verification Logic:**

```typescript
// Calculate actual slippage from on-chain data
const expectedOutput = receipt.swap_details.expected_output;
const actualOutput = outputDelta.amount;
const actualSlippage = ((expectedOutput - actualOutput) / expectedOutput) * 100;

// Compare to capability limit
if (actualSlippage > capability.constraints.max_slippage_percent) {
  // Generate proof
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    expected_output: expectedOutput,
    actual_output: actualOutput,
    calculated_slippage: actualSlippage,
    max_allowed: capability.constraints.max_slippage_percent,
    merkle_proof: generateMerkleProof(tx),
  };

  await submitChallenge('SWAP_003_SLIPPAGE', proof);
}
```

**1.2 Programs called are whitelisted DEXs**

**Data Collection:**

```typescript
async function verifyProgramWhitelist(receipt: ExecutionReceipt) {
  const tx = await connection.getParsedTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Extract all program IDs from instructions
  const actualPrograms = new Set<string>();

  for (const ix of tx.transaction.message.instructions) {
    actualPrograms.add(ix.programId.toBase58());
  }

  return Array.from(actualPrograms);
}
```

**Verification Logic:**

```typescript
const allowedPrograms = capability.allowed_programs;
const actualPrograms = await verifyProgramWhitelist(receipt);

for (const program of actualPrograms) {
  if (!allowedPrograms.includes(program)) {
    const proof = {
      tx_signature: receipt.execution.tx_signatures[0],
      unauthorized_program: program,
      allowed_programs: allowedPrograms,
      instruction_index: findInstructionIndex(tx, program),
      merkle_proof: generateMerkleProof(tx),
    };

    await submitChallenge('SWAP_002_PROGRAM_WHITELIST', proof);
  }
}
```

**1.3 Transfer amount within limits**

**Data Collection:**

```typescript
async function verifyTransferLimit(receipt: ExecutionReceipt) {
  // Fetch price from protocol-approved oracle (NOT agent's claim)
  const oracleAccount = await connection.getAccountInfo(PYTH_USDC_PRICE_FEED);
  const priceData = parsePythPrice(oracleAccount.data);

  // Convert input amount to USDC equivalent
  const inputToken = receipt.swap_details.input_token;
  const inputAmount = receipt.swap_details.input_amount;

  const tokenPrice = await getTokenPrice(inputToken, priceData);
  const usdcEquivalent =
    (inputAmount * tokenPrice) / Math.pow(10, getDecimals(inputToken));

  return { usdcEquivalent, oraclePrice: tokenPrice };
}
```

**Verification Logic:**

```typescript
const { usdcEquivalent, oraclePrice } = await verifyTransferLimit(receipt);
const maxLimit = capability.constraints.max_single_transfer_usdc;

if (usdcEquivalent > maxLimit) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    input_amount: receipt.swap_details.input_amount,
    oracle_price: oraclePrice,
    usdc_equivalent: usdcEquivalent,
    max_limit: maxLimit,
    oracle_account: PYTH_USDC_PRICE_FEED,
    oracle_signature: priceData.signature,
  };

  await submitChallenge('SWAP_004_TRANSFER_LIMIT', proof);
}
```

**1.4 Route hops within limit**

**Data Collection:**

```typescript
async function verifyRouteHops(receipt: ExecutionReceipt) {
  const tx = await connection.getParsedTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Count swap instructions in transaction
  let hopCount = 0;

  for (const ix of tx.transaction.message.instructions) {
    const ixData = decodeJupiterInstruction(ix);
    if (ixData?.type === 'swap' || ixData?.type === 'route') {
      hopCount++;
    }
  }

  return hopCount;
}
```

**Verification Logic:**

```typescript
const actualHops = await verifyRouteHops(receipt);
const maxHops = capability.constraints.max_route_hops;

if (actualHops > maxHops) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    actual_hops: actualHops,
    max_hops: maxHops,
    instruction_indices: findSwapInstructions(tx),
  };

  await submitChallenge('SWAP_007_ROUTE_HOP_LIMIT', proof);
}
```

**1.5 Price impact acceptable**

**Data Collection:**

```typescript
async function verifyPriceImpact(receipt: ExecutionReceipt) {
  // Get fair market price from oracle
  const oraclePrice = await getOraclePrice(
    receipt.swap_details.input_token,
    receipt.swap_details.output_token,
  );

  // Get execution price from transaction
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );
  const { inputDelta, outputDelta } = extractTokenDeltas(tx);

  const executionPrice = outputDelta / inputDelta;
  const priceImpact =
    Math.abs((executionPrice - oraclePrice) / oraclePrice) * 100;

  return { priceImpact, oraclePrice, executionPrice };
}
```

**Verification Logic:**

```typescript
const { priceImpact } = await verifyPriceImpact(receipt);
const maxImpact = capability.constraints.max_price_impact || 1.0;

if (priceImpact > maxImpact) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    price_impact: priceImpact,
    max_impact: maxImpact,
    oracle_price: oraclePrice,
    execution_price: executionPrice,
  };

  await submitChallenge('SWAP_005_PRICE_IMPACT', proof);
}
```

**1.6 Deadline met**

**Data Collection:**

```typescript
async function verifyDeadline(receipt: ExecutionReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );
  const block = await connection.getBlock(tx.slot);

  return {
    blockTimestamp: block.blockTime,
    claimedTimestamp: receipt.timestamp_unix,
    deadline: taskRecord.deadline,
  };
}
```

**Verification Logic:**

```typescript
const { blockTimestamp, deadline } = await verifyDeadline(receipt);

if (blockTimestamp > deadline) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    block_timestamp: blockTimestamp,
    deadline: deadline,
    slot: tx.slot,
  };

  await submitChallenge('SWAP_001_DEADLINE', proof);
}
```

---

### 2. LIMIT_ORDER

#### Verifiable Properties

**2.1 Order price within market bounds**

**Data Collection:**

```typescript
async function verifyOrderPrice(receipt: LimitOrderReceipt) {
  // Fetch current market price
  const marketPrice = await getOraclePrice(
    receipt.order_details.base_token,
    receipt.order_details.quote_token,
  );

  // Get order book state
  const orderBookAccount = await connection.getAccountInfo(
    receipt.order_details.order_book_address,
  );
  const orderBook = parseOrderBook(orderBookAccount.data);

  return {
    marketPrice,
    orderPrice: receipt.order_details.limit_price,
    spreadPercent: calculateSpread(
      marketPrice,
      receipt.order_details.limit_price,
    ),
  };
}
```

**Verification Logic:**

```typescript
const { spreadPercent } = await verifyOrderPrice(receipt);
const maxSpread = capability.constraints.max_order_spread_percent || 5.0;

if (spreadPercent > maxSpread) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    limit_price: receipt.order_details.limit_price,
    market_price: marketPrice,
    spread_percent: spreadPercent,
    max_spread: maxSpread,
  };

  await submitChallenge('LIMIT_ORDER_001_PRICE_BOUNDS', proof);
}
```

**2.2 Order size within limits**

**Data Collection:**

```typescript
async function verifyOrderSize(receipt: LimitOrderReceipt) {
  const orderSize = receipt.order_details.size;
  const price = receipt.order_details.limit_price;

  // Convert to USDC equivalent
  const quoteToken = receipt.order_details.quote_token;
  const quotePrice = await getTokenPrice(quoteToken);
  const usdcEquivalent = orderSize * price * quotePrice;

  return { usdcEquivalent };
}
```

**Verification Logic:**

```typescript
const { usdcEquivalent } = await verifyOrderSize(receipt);
const maxOrderSize = capability.constraints.max_order_size_usdc;

if (usdcEquivalent > maxOrderSize) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    order_size: receipt.order_details.size,
    usdc_equivalent: usdcEquivalent,
    max_order_size: maxOrderSize,
  };

  await submitChallenge('LIMIT_ORDER_002_SIZE_LIMIT', proof);
}
```

**2.3 Expiry timestamp valid**

**Data Collection:**

```typescript
async function verifyExpiry(receipt: LimitOrderReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );
  const block = await connection.getBlock(tx.slot);

  const expiryTimestamp = receipt.order_details.expiry_timestamp;
  const creationTimestamp = block.blockTime;
  const maxDuration =
    capability.constraints.max_order_duration_seconds || 86400 * 30; // 30 days

  return {
    creationTimestamp,
    expiryTimestamp,
    duration: expiryTimestamp - creationTimestamp,
    maxDuration,
  };
}
```

**Verification Logic:**

```typescript
const { duration, maxDuration } = await verifyExpiry(receipt);

if (duration > maxDuration) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    expiry_timestamp: receipt.order_details.expiry_timestamp,
    creation_timestamp: creationTimestamp,
    duration: duration,
    max_duration: maxDuration,
  };

  await submitChallenge('LIMIT_ORDER_003_EXPIRY', proof);
}
```

---

### 3. ADD_LIQUIDITY

#### Verifiable Properties

**3.1 Pool program whitelisted**

**Data Collection:**

```typescript
async function verifyPoolProgram(receipt: AddLiquidityReceipt) {
  const tx = await connection.getParsedTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Find the pool program from instructions
  const poolProgram = tx.transaction.message.instructions
    .find((ix) => ix.accounts.includes(receipt.liquidity_details.pool_address))
    ?.programId.toBase58();

  return { poolProgram };
}
```

**Verification Logic:**

```typescript
const { poolProgram } = await verifyPoolProgram(receipt);
const allowedPrograms = capability.allowed_programs;

if (!allowedPrograms.includes(poolProgram)) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    pool_program: poolProgram,
    pool_address: receipt.liquidity_details.pool_address,
    allowed_programs: allowedPrograms,
  };

  await submitChallenge('ADD_LIQUIDITY_001_POOL_PROGRAM', proof);
}
```

**3.2 Token ratio matches pool**

**Data Collection:**

```typescript
async function verifyTokenRatio(receipt: AddLiquidityReceipt) {
  // Fetch pool state BEFORE the transaction
  const prePoolState = await getHistoricalPoolState(
    receipt.liquidity_details.pool_address,
    receipt.execution.tx_signatures[0],
  );

  // Calculate expected ratio
  const expectedRatio =
    prePoolState.token_a_reserve / prePoolState.token_b_reserve;

  // Get actual deposited ratio
  const actualRatio =
    receipt.liquidity_details.token_a_amount /
    receipt.liquidity_details.token_b_amount;

  const ratioDelta =
    Math.abs((actualRatio - expectedRatio) / expectedRatio) * 100;

  return { ratioDelta, expectedRatio, actualRatio };
}
```

**Verification Logic:**

```typescript
const { ratioDelta } = await verifyTokenRatio(receipt);
const maxRatioDelta = capability.constraints.max_ratio_delta_percent || 1.0;

if (ratioDelta > maxRatioDelta) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    expected_ratio: expectedRatio,
    actual_ratio: actualRatio,
    delta_percent: ratioDelta,
    max_delta: maxRatioDelta,
    pool_state_snapshot: prePoolState,
  };

  await submitChallenge('ADD_LIQUIDITY_002_TOKEN_RATIO', proof);
}
```

**3.3 Minimum LP tokens received**

**Data Collection:**

```typescript
async function verifyMinLPTokens(receipt: AddLiquidityReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Find LP token mint changes
  const lpTokenDelta = findTokenDelta(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
    receipt.liquidity_details.lp_token_mint,
  );

  const actualLPReceived = lpTokenDelta.amount;
  const minimumExpected = receipt.liquidity_details.min_lp_tokens;

  return { actualLPReceived, minimumExpected };
}
```

**Verification Logic:**

```typescript
const { actualLPReceived, minimumExpected } = await verifyMinLPTokens(receipt);

if (actualLPReceived < minimumExpected) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    actual_lp_received: actualLPReceived,
    minimum_expected: minimumExpected,
    lp_token_mint: receipt.liquidity_details.lp_token_mint,
  };

  await submitChallenge('ADD_LIQUIDITY_003_MIN_LP_TOKENS', proof);
}
```

---

### 4. REMOVE_LIQUIDITY

#### Verifiable Properties

**4.1 LP token amount valid**

**Data Collection:**

```typescript
async function verifyLPTokenAmount(receipt: RemoveLiquidityReceipt) {
  // Get agent's LP token balance BEFORE transaction
  const preBalance = await getHistoricalTokenBalance(
    receipt.agent_id,
    receipt.liquidity_details.lp_token_mint,
    receipt.execution.tx_signatures[0],
  );

  const burnedAmount = receipt.liquidity_details.lp_token_amount;

  return { preBalance, burnedAmount };
}
```

**Verification Logic:**

```typescript
const { preBalance, burnedAmount } = await verifyLPTokenAmount(receipt);

if (burnedAmount > preBalance) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    pre_balance: preBalance,
    burned_amount: burnedAmount,
    lp_token_mint: receipt.liquidity_details.lp_token_mint,
  };

  await submitChallenge('REMOVE_LIQUIDITY_001_LP_AMOUNT', proof);
}
```

**4.2 Minimum token outputs received**

**Data Collection:**

```typescript
async function verifyMinOutputs(receipt: RemoveLiquidityReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  const tokenADelta = findTokenDelta(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
    receipt.liquidity_details.token_a_mint,
  );

  const tokenBDelta = findTokenDelta(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
    receipt.liquidity_details.token_b_mint,
  );

  return {
    actualTokenA: tokenADelta.amount,
    actualTokenB: tokenBDelta.amount,
    minTokenA: receipt.liquidity_details.min_token_a_amount,
    minTokenB: receipt.liquidity_details.min_token_b_amount,
  };
}
```

**Verification Logic:**

```typescript
const { actualTokenA, actualTokenB, minTokenA, minTokenB } =
  await verifyMinOutputs(receipt);

if (actualTokenA < minTokenA || actualTokenB < minTokenB) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    actual_token_a: actualTokenA,
    actual_token_b: actualTokenB,
    min_token_a: minTokenA,
    min_token_b: minTokenB,
  };

  await submitChallenge('REMOVE_LIQUIDITY_002_MIN_OUTPUTS', proof);
}
```

---

### 5. STAKE

#### Verifiable Properties

**5.1 Staking program whitelisted**

**Data Collection:**

```typescript
async function verifyStakingProgram(receipt: StakeReceipt) {
  const tx = await connection.getParsedTransaction(
    receipt.execution.tx_signatures[0],
  );

  const stakingProgram = tx.transaction.message.instructions
    .find((ix) =>
      ix.accounts.includes(receipt.stake_details.stake_pool_address),
    )
    ?.programId.toBase58();

  return { stakingProgram };
}
```

**Verification Logic:**

```typescript
const { stakingProgram } = await verifyStakingProgram(receipt);

if (!capability.allowed_programs.includes(stakingProgram)) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    staking_program: stakingProgram,
    stake_pool: receipt.stake_details.stake_pool_address,
  };

  await submitChallenge('STAKE_001_PROGRAM_WHITELIST', proof);
}
```

**5.2 Stake amount within limits**

**Data Collection:**

```typescript
async function verifyStakeAmount(receipt: StakeReceipt) {
  const stakeAmount = receipt.stake_details.amount;
  const tokenMint = receipt.stake_details.token_mint;

  // Convert to USDC equivalent
  const tokenPrice = await getOraclePrice(tokenMint);
  const usdcEquivalent =
    (stakeAmount * tokenPrice) / Math.pow(10, getDecimals(tokenMint));

  return { usdcEquivalent };
}
```

**Verification Logic:**

```typescript
const { usdcEquivalent } = await verifyStakeAmount(receipt);
const maxStake = capability.constraints.max_stake_amount_usdc;

if (usdcEquivalent > maxStake) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    stake_amount: receipt.stake_details.amount,
    usdc_equivalent: usdcEquivalent,
    max_stake: maxStake,
  };

  await submitChallenge('STAKE_002_AMOUNT_LIMIT', proof);
}
```

**5.3 Lock period matches agreement**

**Data Collection:**

```typescript
async function verifyLockPeriod(receipt: StakeReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Parse stake account to get unlock timestamp
  const stakeAccount = await connection.getAccountInfo(
    receipt.stake_details.stake_account,
  );
  const stakeData = parseStakeAccount(stakeAccount.data);

  const lockPeriod = stakeData.unlock_timestamp - tx.blockTime;

  return { lockPeriod };
}
```

**Verification Logic:**

```typescript
const { lockPeriod } = await verifyLockPeriod(receipt);
const maxLockPeriod = capability.constraints.max_lock_period_seconds;

if (lockPeriod > maxLockPeriod) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    lock_period: lockPeriod,
    max_lock_period: maxLockPeriod,
    stake_account: receipt.stake_details.stake_account,
  };

  await submitChallenge('STAKE_003_LOCK_PERIOD', proof);
}
```

---

### 6. BORROW

#### Verifiable Properties

**6.1 Collateral ratio maintained**

**Data Collection:**

```typescript
async function verifyCollateralRatio(receipt: BorrowReceipt) {
  // Fetch lending position state AFTER borrow
  const positionAccount = await connection.getAccountInfo(
    receipt.borrow_details.position_address,
  );
  const position = parseLendingPosition(positionAccount.data);

  // Calculate collateral ratio
  const collateralValue = await calculateCollateralValue(
    position.collateral_amount,
    position.collateral_mint,
  );

  const borrowValue = await calculateBorrowValue(
    position.borrow_amount,
    position.borrow_mint,
  );

  const collateralRatio = (collateralValue / borrowValue) * 100;

  return { collateralRatio, collateralValue, borrowValue };
}
```

**Verification Logic:**

```typescript
const { collateralRatio } = await verifyCollateralRatio(receipt);
const minRatio = capability.constraints.min_collateral_ratio_percent || 150;

if (collateralRatio < minRatio) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    collateral_ratio: collateralRatio,
    min_ratio: minRatio,
    collateral_value: collateralValue,
    borrow_value: borrowValue,
    position_address: receipt.borrow_details.position_address,
  };

  await submitChallenge('BORROW_001_COLLATERAL_RATIO', proof);
}
```

**6.2 Borrow amount within limits**

**Data Collection:**

```typescript
async function verifyBorrowAmount(receipt: BorrowReceipt) {
  const borrowAmount = receipt.borrow_details.amount;
  const borrowToken = receipt.borrow_details.borrow_mint;

  // Convert to USDC equivalent
  const tokenPrice = await getOraclePrice(borrowToken);
  const usdcEquivalent =
    (borrowAmount * tokenPrice) / Math.pow(10, getDecimals(borrowToken));

  return { usdcEquivalent };
}
```

**Verification Logic:**

```typescript
const { usdcEquivalent } = await verifyBorrowAmount(receipt);
const maxBorrow = capability.constraints.max_borrow_amount_usdc;

if (usdcEquivalent > maxBorrow) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    borrow_amount: receipt.borrow_details.amount,
    usdc_equivalent: usdcEquivalent,
    max_borrow: maxBorrow,
  };

  await submitChallenge('BORROW_002_AMOUNT_LIMIT', proof);
}
```

**6.3 Interest rate as expected**

**Data Collection:**

```typescript
async function verifyInterestRate(receipt: BorrowReceipt) {
  // Fetch lending pool state
  const poolAccount = await connection.getAccountInfo(
    receipt.borrow_details.lending_pool,
  );
  const pool = parseLendingPool(poolAccount.data);

  // Get actual interest rate from pool
  const actualInterestRate = pool.current_borrow_rate;
  const claimedInterestRate = receipt.borrow_details.interest_rate;

  const rateDelta = Math.abs(actualInterestRate - claimedInterestRate);

  return { actualInterestRate, claimedInterestRate, rateDelta };
}
```

**Verification Logic:**

```typescript
const { rateDelta } = await verifyInterestRate(receipt);
const maxRateDelta = 0.01; // 1 basis point tolerance

if (rateDelta > maxRateDelta) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    actual_interest_rate: actualInterestRate,
    claimed_interest_rate: claimedInterestRate,
    delta: rateDelta,
  };

  await submitChallenge('BORROW_003_INTEREST_RATE', proof);
}
```

---

### 7. TRANSFER

#### Verifiable Properties

**7.1 Recipient address whitelisted**

**Data Collection:**

```typescript
async function verifyRecipient(receipt: TransferReceipt) {
  const recipientAddress = receipt.transfer_details.recipient;
  const allowedRecipients = capability.allowed_recipients || [];

  return { recipientAddress, allowedRecipients };
}
```

**Verification Logic:**

```typescript
const { recipientAddress, allowedRecipients } = await verifyRecipient(receipt);

// If whitelist is enabled but address not in list
if (
  allowedRecipients.length > 0 &&
  !allowedRecipients.includes(recipientAddress)
) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    recipient: recipientAddress,
    allowed_recipients: allowedRecipients,
  };

  await submitChallenge('TRANSFER_001_RECIPIENT_WHITELIST', proof);
}
```

**7.2 Transfer amount within limits**

**Data Collection:**

```typescript
async function verifyTransferAmount(receipt: TransferReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Verify actual transferred amount matches claim
  const tokenDelta = findTokenDelta(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
    receipt.transfer_details.token_mint,
  );

  const actualAmount = Math.abs(tokenDelta.amount);
  const claimedAmount = receipt.transfer_details.amount;

  // Convert to USDC equivalent
  const tokenPrice = await getOraclePrice(receipt.transfer_details.token_mint);
  const usdcEquivalent =
    (actualAmount * tokenPrice) /
    Math.pow(10, getDecimals(receipt.transfer_details.token_mint));

  return { actualAmount, claimedAmount, usdcEquivalent };
}
```

**Verification Logic:**

```typescript
const { actualAmount, claimedAmount, usdcEquivalent } =
  await verifyTransferAmount(receipt);
const maxTransfer = capability.constraints.max_transfer_amount_usdc;

if (actualAmount !== claimedAmount) {
  // Agent lied about amount
  await submitChallenge('TRANSFER_002_AMOUNT_MISMATCH', {
    actualAmount,
    claimedAmount,
  });
}

if (usdcEquivalent > maxTransfer) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    transfer_amount: actualAmount,
    usdc_equivalent: usdcEquivalent,
    max_transfer: maxTransfer,
  };

  await submitChallenge('TRANSFER_003_AMOUNT_LIMIT', proof);
}
```

---

### 8. FLASH_LOAN

#### Verifiable Properties

**8.1 Loan repaid in same transaction**

**Data Collection:**

```typescript
async function verifyFlashLoanRepayment(receipt: FlashLoanReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Flash loans must be single transaction
  if (receipt.execution.tx_signatures.length > 1) {
    return { valid: false, reason: 'multiple_transactions' };
  }

  // Parse all token deltas
  const tokenDeltas = calculateAllTokenDeltas(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
  );

  // For flash loan, borrowed token delta should be >= 0 (paid back + fee)
  const loanToken = receipt.flash_loan_details.loan_mint;
  const loanDelta = tokenDeltas.find((d) => d.mint === loanToken);

  return { loanDelta };
}
```

**Verification Logic:**

```typescript
const { loanDelta } = await verifyFlashLoanRepayment(receipt);

// Net change should be negative or zero (we paid back + fee)
if (loanDelta.amount > 0) {
  // Agent received net tokens - loan not repaid!
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    loan_amount: receipt.flash_loan_details.loan_amount,
    net_delta: loanDelta.amount,
    loan_mint: receipt.flash_loan_details.loan_mint,
  };

  await submitChallenge('FLASH_LOAN_001_REPAYMENT', proof);
}
```

**8.2 Fee paid correctly**

**Data Collection:**

```typescript
async function verifyFlashLoanFee(receipt: FlashLoanReceipt) {
  // Fetch protocol's flash loan fee rate
  const protocolAccount = await connection.getAccountInfo(
    receipt.flash_loan_details.protocol_address,
  );
  const protocol = parseFlashLoanProtocol(protocolAccount.data);

  const expectedFee =
    (receipt.flash_loan_details.loan_amount * protocol.fee_bps) / 10000;
  const claimedFee = receipt.flash_loan_details.fee_paid;

  return { expectedFee, claimedFee };
}
```

**Verification Logic:**

```typescript
const { expectedFee, claimedFee } = await verifyFlashLoanFee(receipt);

if (Math.abs(expectedFee - claimedFee) > 1) {
  // Allow 1 lamport rounding
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    expected_fee: expectedFee,
    claimed_fee: claimedFee,
    protocol_address: receipt.flash_loan_details.protocol_address,
  };

  await submitChallenge('FLASH_LOAN_002_FEE', proof);
}
```

---

### 9. ARBITRAGE

#### Verifiable Properties

**9.1 Net profit positive**

**Data Collection:**

```typescript
async function verifyArbitrageProfit(receipt: ArbitrageReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Calculate all token deltas
  const tokenDeltas = calculateAllTokenDeltas(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
  );

  // Convert all to USDC equivalent
  let netProfitUSDC = 0;
  for (const delta of tokenDeltas) {
    const price = await getOraclePrice(delta.mint);
    const usdcValue =
      (delta.amount * price) / Math.pow(10, getDecimals(delta.mint));
    netProfitUSDC += usdcValue;
  }

  // Subtract gas fees
  const gasFees = tx.meta.fee / LAMPORTS_PER_SOL;
  const solPrice = await getOraclePrice(SOL_MINT);
  const gasFeeUSDC = gasFees * solPrice;

  netProfitUSDC -= gasFeeUSDC;

  return { netProfitUSDC, gasFeeUSDC };
}
```

**Verification Logic:**

```typescript
const { netProfitUSDC } = await verifyArbitrageProfit(receipt);

if (netProfitUSDC <= 0) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    net_profit: netProfitUSDC,
    gas_fee: gasFeeUSDC,
    token_deltas: tokenDeltas,
  };

  await submitChallenge('ARBITRAGE_001_NET_PROFIT', proof);
}
```

---

### 10. LIQUIDATE

#### Verifiable Properties

**10.1 Target position actually underwater**

**Data Collection:**

```typescript
async function verifyLiquidationEligibility(receipt: LiquidateReceipt) {
  // Fetch position state BEFORE liquidation
  const prePositionState = await getHistoricalAccountState(
    receipt.liquidation_details.target_position,
    receipt.execution.tx_signatures[0],
  );

  const position = parseLendingPosition(prePositionState);

  // Calculate health factor
  const collateralValue = await calculateCollateralValue(
    position.collateral_amount,
    position.collateral_mint,
  );

  const borrowValue = await calculateBorrowValue(
    position.borrow_amount,
    position.borrow_mint,
  );

  const healthFactor = collateralValue / borrowValue;

  // Fetch liquidation threshold from protocol
  const protocolAccount = await connection.getAccountInfo(
    receipt.liquidation_details.lending_protocol,
  );
  const protocol = parseLendingProtocol(protocolAccount.data);

  return { healthFactor, liquidationThreshold: protocol.liquidation_threshold };
}
```

**Verification Logic:**

```typescript
const { healthFactor, liquidationThreshold } =
  await verifyLiquidationEligibility(receipt);

if (healthFactor >= liquidationThreshold) {
  // Position was NOT underwater - illegal liquidation!
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    health_factor: healthFactor,
    liquidation_threshold: liquidationThreshold,
    target_position: receipt.liquidation_details.target_position,
    position_state_snapshot: prePositionState,
  };

  await submitChallenge('LIQUIDATE_001_ELIGIBILITY', proof);
}
```

**10.2 Liquidation bonus within protocol limits**

**Data Collection:**

```typescript
async function verifyLiquidationBonus(receipt: LiquidateReceipt) {
  const tx = await connection.getTransaction(
    receipt.execution.tx_signatures[0],
  );

  // Calculate collateral seized
  const collateralSeized = findTokenDelta(
    tx.meta.preTokenBalances,
    tx.meta.postTokenBalances,
    receipt.liquidation_details.collateral_mint,
  ).amount;

  // Calculate debt repaid
  const debtRepaid = receipt.liquidation_details.debt_repaid;

  // Fetch protocol's liquidation bonus
  const protocolAccount = await connection.getAccountInfo(
    receipt.liquidation_details.lending_protocol,
  );
  const protocol = parseLendingProtocol(protocolAccount.data);

  const expectedCollateral =
    debtRepaid * (1 + protocol.liquidation_bonus_bps / 10000);

  return { collateralSeized, expectedCollateral, debtRepaid };
}
```

**Verification Logic:**

```typescript
const { collateralSeized, expectedCollateral } =
  await verifyLiquidationBonus(receipt);
const tolerance = 0.01; // 1% tolerance

if (
  Math.abs(collateralSeized - expectedCollateral) / expectedCollateral >
  tolerance
) {
  const proof = {
    tx_signature: receipt.execution.tx_signatures[0],
    collateral_seized: collateralSeized,
    expected_collateral: expectedCollateral,
    debt_repaid: debtRepaid,
  };

  await submitChallenge('LIQUIDATE_002_BONUS', proof);
}
```

---

## Proof Generation

### Merkle Proof Structure

All challenges include a Merkle proof to verify the transaction data:

```typescript
interface ChallengeProof {
  // Universal fields
  tx_signature: string;
  block_slot: number;
  merkle_root: string;
  merkle_proof: string[];

  // Rule-specific data
  violation_type: string;
  violation_data: any;

  // Oracle proofs (when applicable)
  oracle_price?: number;
  oracle_signature?: string;
  oracle_timestamp?: number;
}
```

### Generating Merkle Proofs

```typescript
async function generateMerkleProof(tx: Transaction): Promise<string[]> {
  // Get all transactions in the block
  const block = await connection.getBlock(tx.slot);

  // Build Merkle tree of transaction signatures
  const tree = new MerkleTree(
    block.transactions.map((t) => t.transaction.signatures[0]),
  );

  // Generate proof for our specific transaction
  const proof = tree.getProof(tx.transaction.signatures[0]);

  return proof.map((p) => p.toString('hex'));
}
```

---

## Node Implementation

### Main Verification Loop

```typescript
async function runVerificationNode() {
  while (true) {
    // 1. Fetch new receipts from Arweave
    const newReceipts = await fetchNewReceipts();

    // 2. For each receipt, run all applicable verifications
    for (const receipt of newReceipts) {
      try {
        await verifyReceipt(receipt);
      } catch (error) {
        console.error(`Verification failed for ${receipt.task_id}:`, error);
      }
    }

    // 3. Wait before next check
    await sleep(30000); // 30 seconds
  }
}

async function verifyReceipt(receipt: ExecutionReceipt) {
  // Load agent capability
  const capability = await fetchAgentCapability(receipt.agent_id);

  // Load operation-specific rules
  const rules = await loadVerificationRules(receipt.operation_type);

  // Apply each rule
  for (const rule of rules.rules) {
    if (!rule.auto_adjudicable) continue; // Skip manual review rules

    const verifier = getVerifier(rule.assertion_type);
    const result = await verifier(receipt, capability);

    if (!result.passed) {
      console.log(`Rule ${rule.rule_id} failed for ${receipt.task_id}`);
      await submitChallenge(receipt.task_id, rule.rule_id, result.proof);
    }
  }
}
```

### Challenge Submission

```typescript
async function submitChallenge(
  taskId: string,
  ruleId: string,
  proof: ChallengeProof,
) {
  // Build on-chain transaction
  const tx = await program.methods
    .submitChallenge(taskId, ruleId, proof)
    .accounts({
      challenger: nodeWallet.publicKey,
      challengerRegistry: challengerPDA,
      taskRecord: taskPDA,
      agentRegistry: agentPDA,
    })
    .rpc();

  console.log(`Challenge submitted: ${tx}`);
}
```

---

## Summary

**Off-chain verification nodes provide:**

1. ✅ Full transaction parsing (instructions, account changes, balances)
2. ✅ Oracle price lookups (Pyth, Switchboard)
3. ✅ Historical state queries (pre-transaction account states)
4. ✅ Complex calculations (slippage, PnL, collateral ratios)
5. ✅ Cryptographic proof generation (Merkle trees)
6. ✅ Batch processing and indexing

**On-chain contracts validate:**

1. ✅ Proof authenticity (signature verification)
2. ✅ Proof correctness (Merkle root validation)
3. ✅ Execute slashing (automated, no governance)
4. ✅ Distribute rewards (60% challenger, 40% DAO)

This hybrid approach maximizes security while minimizing on-chain compute costs.
