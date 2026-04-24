import type { Agent, Task, StakerPosition, RepPoint } from '@/types'
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) { return clsx(inputs) }

export function repColor(score: number) {
  if (score >= 70) return '#4A7A58'
  if (score >= 45) return '#8B6A2C'
  return '#8B4A3C'
}

export function formatUsdc(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}

export function capBadgeClass(_cap: string) {
  return 'bg-jade/20 text-jadeDark border-jade/30'
}

export function statusCfg(s: string) {
  const m: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completed', cls: 'bg-success/10 text-success border-success/25' },
    executing: { label: 'Executing', cls: 'bg-jadeDark/15 text-jadeDark border-jadeDark/30' },
    pending: { label: 'Pending', cls: 'bg-amber/10 text-amber border-amber/25' },
    challenged: { label: 'Challenged', cls: 'bg-danger/10 text-danger border-danger/25' },
    slashed: { label: 'Slashed', cls: 'bg-danger/15 text-danger border-danger/30' },
    healthy: { label: 'Healthy', cls: 'bg-success/10 text-success border-success/25' },
    at_risk: { label: 'At Risk', cls: 'bg-amber/10 text-amber border-amber/25' },
  }
  return m[s] ?? { label: s, cls: 'bg-stone text-muted border-border' }
}

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'a1', name: 'TradeBot Alpha', address: '7f3a...8b4e', operator: 'GkX7...abc1',
    capability: ['DEX_TRADER_V1', 'LP_MANAGER_V1'], capabilityHash: '0x8f3a...c291',
    reputationScore: 7240, slashCount: 0, totalTasks: 1284, successRate: 99.1,
    totalStake: 8240, validatorStake: 5000, communityStake: 3240, stakerCount: 4,
    arweaveCid: 'Qm7f3...8b4e', registeredAt: '2026-03-14', featured: true
  },
  {
    id: 'a2', name: 'YieldBot Pro', address: '88y1...9c3a', operator: 'HmY8...def2',
    capability: ['YIELD_OPTIMIZER_V1'], capabilityHash: '0x9a1b...d402',
    reputationScore: 8810, slashCount: 0, totalTasks: 3401, successRate: 99.7,
    totalStake: 12100, validatorStake: 8000, communityStake: 4100, stakerCount: 7,
    arweaveCid: 'Qm88y...9c3a', registeredAt: '2026-01-07', featured: true
  },
  {
    id: 'a3', name: 'LPBot Genesis', address: '3c1f...7e2b', operator: 'JnK2...ghi3',
    capability: ['LP_MANAGER_V1'], capabilityHash: '0x3c1f...b820',
    reputationScore: 3120, slashCount: 1, totalTasks: 442, successRate: 89.4,
    totalStake: 4800, validatorStake: 3000, communityStake: 1800, stakerCount: 3,
    arweaveCid: 'Qm3c1...7e2b', registeredAt: '2026-03-25', featured: false
  },
  {
    id: 'a4', name: 'Arbitron V2', address: '64ab...1d9f', operator: 'LpQ3...jkl4',
    capability: ['DEX_TRADER_V1'], capabilityHash: '0x64ab...e710',
    reputationScore: 6400, slashCount: 0, totalTasks: 922, successRate: 97.8,
    totalStake: 6500, validatorStake: 4500, communityStake: 2000, stakerCount: 5,
    arweaveCid: 'Qm64a...1d9f', registeredAt: '2026-03-06', featured: false
  },
  {
    id: 'a5', name: 'KaminoMaxi', address: '91km...2a8c', operator: 'NrT4...mno5',
    capability: ['YIELD_OPTIMIZER_V1', 'LP_MANAGER_V1'], capabilityHash: '0x91km...f930',
    reputationScore: 9100, slashCount: 0, totalTasks: 5120, successRate: 99.9,
    totalStake: 22000, validatorStake: 15000, communityStake: 7000, stakerCount: 12,
    arweaveCid: 'Qm91k...2a8c', registeredAt: '2026-01-08', featured: true
  },
  {
    id: 'a6', name: 'PortfolioBot', address: '55pf...4c7e', operator: 'PsU5...pqr6',
    capability: ['PORTFOLIO_MGMT_V1'], capabilityHash: '0x55pf...a120',
    reputationScore: 5500, slashCount: 0, totalTasks: 210, successRate: 96.2,
    totalStake: 3100, validatorStake: 2000, communityStake: 1100, stakerCount: 2,
    arweaveCid: 'Qm55p...4c7e', registeredAt: '2026-03-29', featured: false
  },
]

export const MOCK_TASKS: Task[] = [
  {
    id: 'task_7f3a', agentId: 'a1', agentName: 'TradeBot Alpha', assignedBy: 'GkX7...abc1',
    description: 'Swap 500 USDC → SOL via Jupiter Ultra', status: 'completed',
    deadline: '14:30 UTC', completedAt: '14:28 UTC', outputHash: '0x7f3a...c291',
    arweaveCid: 'Qm7f3...', txSignatures: ['5Kj8...'], timestamp: '2 min ago'
  },
  {
    id: 'task_6b2c', agentId: 'a1', agentName: 'TradeBot Alpha', assignedBy: 'GkX7...abc1',
    description: 'Add liquidity SOL/USDC on Orca Whirlpool', status: 'executing',
    deadline: '15:00 UTC', txSignatures: [], timestamp: '18 min ago'
  },
  {
    id: 'task_4d9e', agentId: 'a2', agentName: 'YieldBot Pro', assignedBy: 'HmY8...def2',
    description: 'DCA buy BONK — 50 USDC/day for 10 days', status: 'completed',
    deadline: 'Ongoing', outputHash: '0x4d9e...a130', arweaveCid: 'Qm4d9...',
    txSignatures: ['4Dk9...'], timestamp: '1h ago'
  },
  {
    id: 'task_3c1f', agentId: 'a5', agentName: 'KaminoMaxi', assignedBy: 'NrT4...mno5',
    description: 'Deposit 200 USDC into Kamino USDC vault', status: 'pending',
    deadline: '18:00 UTC', txSignatures: [], timestamp: '2h ago'
  },
  {
    id: 'task_2a8b', agentId: 'a3', agentName: 'LPBot Genesis', assignedBy: 'JnK2...ghi3',
    description: 'Rebalance portfolio — 60% SOL / 40% USDC', status: 'challenged',
    deadline: '12:00 UTC', outputHash: '0x2a8b...f920', txSignatures: ['7Rm3...'], timestamp: '4h ago'
  },
  {
    id: 'task_1e5d', agentId: 'a4', agentName: 'Arbitron V2', assignedBy: 'LpQ3...jkl4',
    description: 'Execute limit order SOL @ $185', status: 'completed',
    deadline: '10:00 UTC', completedAt: '09:58 UTC', outputHash: '0x1e5d...7c43',
    arweaveCid: 'Qm1e5...', txSignatures: ['2Xk4...'], timestamp: '6h ago'
  },
]

export const MOCK_POSITIONS: StakerPosition[] = [
  {
    agentId: 'a1', agentName: 'TradeBot Alpha', agentRep: 72.4, agentType: 'DEX_TRADER_V1',
    amountStaked: 2000, poolShare: 24.3, claimableRewards: 38.4, totalEarned: 312.8, slashCount: 0
  },
  {
    agentId: 'a2', agentName: 'YieldBot Pro', agentRep: 88.1, agentType: 'YIELD_OPTIMIZER_V1',
    amountStaked: 1800, poolShare: 18.0, claimableRewards: 41.2, totalEarned: 420.6, slashCount: 0
  },
  {
    agentId: 'a3', agentName: 'LPBot Genesis', agentRep: 31.2, agentType: 'LP_MANAGER_V1',
    amountStaked: 1000, poolShare: 20.0, claimableRewards: 12.8, totalEarned: 107.8, slashCount: 1
  },
]

export const MOCK_REP: RepPoint[] = [
  { date: 'Mar 14', score: 12 }, { date: 'Mar 16', score: 24 }, { date: 'Mar 18', score: 28 },
  { date: 'Mar 20', score: 42 }, { date: 'Mar 22', score: 45 }, { date: 'Mar 24', score: 56 },
  { date: 'Mar 26', score: 55 }, { date: 'Mar 28', score: 65 }, { date: 'Mar 30', score: 68 },
  { date: 'Apr 01', score: 70 }, { date: 'Apr 03', score: 74 }, { date: 'Apr 05', score: 71 },
  { date: 'Apr 06', score: 72.4 },
]

export const CAPABILITY_TEMPLATES = [
  { id: 'SOL_TRANSFER', name: 'SOL_TRANSFER', desc: 'SOL transfers · bounded + whitelist' },
  { id: 'JUPITER_TRADER', name: 'JUPITER_TRADER', desc: 'Jupiter, Orca, Raydium swaps · max 50k USDC' },
  { id: 'LP_MANAGER_V1', name: 'LP_MANAGER_V1', desc: 'Add/remove liquidity on major AMMs' },
  { id: 'YIELD_OPTIMIZER_V1', name: 'YIELD_OPTIMIZER_V1', desc: 'Kamino, Drift vaults · deposit/withdraw' },
  { id: 'ORACLE_READER_V1', name: 'ORACLE_READER_V1', desc: 'Pyth + Switchboard price feeds · read-only' },
  { id: 'TOKEN_TRANSFER_V1', name: 'TOKEN_TRANSFER_V1', desc: 'USDC/SOL transfers · bounded + whitelist' },
  { id: 'PORTFOLIO_MGMT_V1', name: 'PORTFOLIO_MGMT_V1', desc: 'Rebalance across whitelisted tokens' },
]
