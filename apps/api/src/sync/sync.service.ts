import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from '../solana/solana.service';
import { AgentsService } from '../agents/agents.service';
import { TasksService } from '../tasks/tasks.service';
import { ChallengesService } from '../attestation/challenges/challenges.service';
import { AttestationService } from '../attestation/services/attestation.service';
import { ChallengeCacheData } from '../attestation/challenges/challenge-cache.entity';
import { TaskStatus } from '@dolores/shared';
import { TaskCacheData } from '../tasks/task-cache.entity';

// Anchor's coder.events.decode() returns event names in camelCase.
const REGISTRY_EVENTS = {
  AGENT_REGISTERED: 'agentRegistered',
  AGENT_SLASHED: 'agentSlashed',
  AGENT_VERIFIED: 'agentVerified',
  ARWEAVE_CID_UPDATED: 'arweaveCidUpdated',
  ATTESTATION_SUBMITTED: 'attestationSubmitted',
} as const;

const FUND_EVENTS = {
  FUND_INITIALIZED: 'fundInitialized',
  STAKED: 'staked',
  UNSTAKED: 'unstaked',
  SLASH_EXECUTED: 'slashExecuted',
  REWARDS_CLAIMED: 'rewardsClaimed',
} as const;

const ADJUDICATION_EVENTS = {
  TASK_REGISTERED: 'taskRegistered',
  TASK_COMPLETED: 'taskCompleted',
  CHALLENGE_FILED: 'challengeFiledEvent',
  CHALLENGE_DISMISSED: 'challengeDismissedEvent',
  AGENT_SLASHED: 'agentSlashedEvent',
} as const;

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private registryLogSubscriptionId: number | null = null;
  private fundLogSubscriptionId: number | null = null;
  private adjudicationLogSubscriptionId: number | null = null;

  constructor(
    private solanaService: SolanaService,
    private agentsService: AgentsService,
    private tasksService: TasksService,
    private challengesService: ChallengesService,
    private attestationService: AttestationService,
  ) {}

  async onModuleInit() {
    await this.startEventListeners();
  }

  onModuleDestroy() {
    this.stopEventListeners();
  }

  /**
   * Start listening to Solana program events
   */
  private async startEventListeners() {
    try {
      const registryProgram = this.solanaService.getRegistryProgram();
      const fundProgram = this.solanaService.getFundProgram();
      const adjudicationProgram = this.solanaService.getAdjudicationProgram();
      const connection = this.solanaService.getConnection();

      // Helper: extract and decode Anchor events from a log array
      const decodeEvents = (program: any, logs: string[]) => {
        const events: Array<{ name: string; data: any }> = [];
        for (const log of logs) {
          if (!log.startsWith('Program data: ')) continue;
          const base64 = log.slice('Program data: '.length);
          try {
            const event = program.coder.events.decode(base64);
            if (event) events.push(event);
          } catch {
            // not an event log line
          }
        }
        return events;
      };

      // Registry
      this.logger.log(
        `Starting Registry log listener for program: ${registryProgram.programId.toBase58()}`,
      );
      this.registryLogSubscriptionId = connection.onLogs(
        registryProgram.programId,
        (logInfo) => {
          if (logInfo.err) return;
          const events = decodeEvents(registryProgram, logInfo.logs);
          for (const event of events) {
            this.logger.log(
              `Registry event: ${event.name} (tx: ${logInfo.signature})`,
            );
            switch (event.name) {
              case REGISTRY_EVENTS.AGENT_REGISTERED:
                this.handleAgentRegistered(event.data);
                break;
              case REGISTRY_EVENTS.AGENT_SLASHED:
                this.handleRegistryAgentSlashed(event.data);
                break;
              case REGISTRY_EVENTS.AGENT_VERIFIED:
                this.attestationService.handleAgentVerified(event.data);
                break;
              case REGISTRY_EVENTS.ARWEAVE_CID_UPDATED:
                this.attestationService.handleArweaveCidUpdated(event.data);
                break;
              case REGISTRY_EVENTS.ATTESTATION_SUBMITTED:
                this.attestationService.handleAttestationSubmitted(event.data);
                break;
              default:
                this.logger.log(`Unknown registry event: ${event.name}`);
            }
          }
        },
        'confirmed',
      );

      // Fund
      this.logger.log(
        `Starting Fund log listener for program: ${fundProgram.programId.toBase58()}`,
      );
      this.fundLogSubscriptionId = connection.onLogs(
        fundProgram.programId,
        (logInfo) => {
          if (logInfo.err) return;
          const events = decodeEvents(fundProgram, logInfo.logs);
          for (const event of events) {
            this.logger.log(
              `Fund event: ${event.name} (tx: ${logInfo.signature})`,
            );
            switch (event.name) {
              case FUND_EVENTS.FUND_INITIALIZED:
                this.handleFundInitialized(event.data);
                break;
              case FUND_EVENTS.STAKED:
                this.handleStaked(event.data);
                break;
              case FUND_EVENTS.UNSTAKED:
                this.handleUnstaked(event.data);
                break;
              case FUND_EVENTS.SLASH_EXECUTED:
                this.handleSlashExecuted(event.data);
                break;
              case FUND_EVENTS.REWARDS_CLAIMED:
                this.logger.log(
                  `RewardsClaimed: staker=${event.data.staker?.toBase58()} amount=${event.data.amount}`,
                );
                break;
              default:
                this.logger.log(`Unknown fund event: ${event.name}`);
            }
          }
        },
        'confirmed',
      );

      // Adjudication
      this.logger.log(
        `Starting Adjudication log listener for program: ${adjudicationProgram.programId.toBase58()}`,
      );
      this.adjudicationLogSubscriptionId = connection.onLogs(
        adjudicationProgram.programId,
        (logInfo) => {
          if (logInfo.err) return;
          const events = decodeEvents(adjudicationProgram, logInfo.logs);
          for (const event of events) {
            this.logger.log(
              `Adjudication event: ${event.name} (tx: ${logInfo.signature})`,
            );
            switch (event.name) {
              case ADJUDICATION_EVENTS.TASK_REGISTERED:
                this.handleTaskRegistered(event.data);
                break;
              case ADJUDICATION_EVENTS.TASK_COMPLETED:
                this.handleTaskCompleted(event.data);
                break;
              case ADJUDICATION_EVENTS.CHALLENGE_FILED:
                this.handleChallengeFiled(event.data);
                break;
              case ADJUDICATION_EVENTS.CHALLENGE_DISMISSED:
                this.handleChallengeDismissed(event.data);
                break;
              case ADJUDICATION_EVENTS.AGENT_SLASHED:
                this.handleAdjudicationAgentSlashed(event.data);
                break;
              default:
                this.logger.log(`Unknown adjudication event: ${event.name}`);
            }
          }
        },
        'confirmed',
      );

      this.logger.log(
        'Started 3 onLogs listeners (registry, fund, adjudication)',
      );
    } catch (error) {
      this.logger.error('Failed to start event listeners', error);
    }
  }

  /**
   * Stop all event listeners
   */
  private async stopEventListeners() {
    try {
      const connection = this.solanaService.getConnection();

      if (this.registryLogSubscriptionId !== null) {
        await connection.removeOnLogsListener(this.registryLogSubscriptionId);
        this.registryLogSubscriptionId = null;
      }
      if (this.fundLogSubscriptionId !== null) {
        await connection.removeOnLogsListener(this.fundLogSubscriptionId);
        this.fundLogSubscriptionId = null;
      }
      if (this.adjudicationLogSubscriptionId !== null) {
        await connection.removeOnLogsListener(
          this.adjudicationLogSubscriptionId,
        );
        this.adjudicationLogSubscriptionId = null;
      }

      this.logger.log('Stopped all event listeners');
    } catch (error) {
      this.logger.error('Failed to stop event listeners', error);
    }
  }

  // ─── Registry handlers ──────────────────────────────────────────────────────

  private async handleAgentRegistered(event: any) {
    this.logger.log(`AgentRegistered: ${event.agent.toBase58()}`);
    try {
      const agentDetails = await this.agentsService.getAgentDetails(
        event.agent.toBase58(),
      );
      this.logger.log(`Cached agent: ${agentDetails.name}`);
    } catch (error) {
      this.logger.error('Failed to cache registered agent', error);
    }
  }

  private async handleRegistryAgentSlashed(event: any) {
    this.logger.log(
      `AgentSlashed (registry): agent=${event.agent.toBase58()} slashCount=${event.slashCount} newReputation=${event.newReputation}`,
    );
    // TODO: update agent reputation in cache
  }

  // ─── Fund handlers ───────────────────────────────────────────────────────────

  private async handleFundInitialized(event: any) {
    this.logger.log(
      `FundInitialized: agent=${event.agent.toBase58()} operator=${event.operator.toBase58()}`,
    );
    try {
      await this.agentsService.getAgentDetails(event.agent.toBase58());
    } catch (error) {
      this.logger.error('Failed to update agent fund details', error);
    }
  }

  private async handleStaked(event: any) {
    this.logger.log(
      `Staked: agent=${event.agent.toBase58()} staker=${event.staker.toBase58()} amount=${event.amount}`,
    );
    // TODO: increment agent.stakeAmount in cache
  }

  private async handleUnstaked(event: any) {
    this.logger.log(
      `Unstaked: agent=${event.agent.toBase58()} staker=${event.staker.toBase58()} amount=${event.amount}`,
    );
    // TODO: decrement agent.stakeAmount in cache
  }

  private async handleSlashExecuted(event: any) {
    this.logger.log(
      `SlashExecuted: agent=${event.agent.toBase58()} slashAmount=${event.slashAmount} remainingStake=${event.remainingStake}`,
    );
    // TODO: update agent.stakeAmount in cache
  }

  // ─── Adjudication handlers ───────────────────────────────────────────────────

  private async handleTaskRegistered(event: any) {
    const taskId = Buffer.from(event.taskId).toString('hex');
    const agentId = event.agent.toBase58();
    const assignedBy = event.assignedBy.toBase58();

    this.logger.log(`TaskRegistered: agent=${agentId} task=${taskId}`);

    try {
      const [challengePda] = this.solanaService.deriveChallengePda(
        new PublicKey(agentId),
        Buffer.from(event.taskId),
      );

      const taskData: TaskCacheData = {
        id: taskId,
        taskId,
        challengePda: challengePda.toBase58(),
        agentId,
        agentName: 'Loading...',
        requester: assignedBy,
        status: 'pending',
        capabilityName: 'unknown',
        parametersJson: '{}',
        stakeAmount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.tasksService.cacheTask(taskData);
      this.logger.log(`Cached task: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to cache registered task', error);
    }
  }

  private async handleTaskCompleted(event: any) {
    const taskId = Buffer.from(event.taskId).toString('hex');
    const agentId = event.agent.toBase58();

    this.logger.log(`TaskCompleted: agent=${agentId} task=${taskId}`);

    try {
      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.COMPLETED,
        { completedAt: Date.now() },
      );
    } catch (error) {
      this.logger.error('Failed to update completed task', error);
    }
  }

  private async handleChallengeFiled(event: any) {
    const taskId = Buffer.from(event.taskId).toString('hex');
    const agentId = event.agent.toBase58();
    const challenger = event.challenger.toBase58();

    this.logger.log(
      `ChallengeFiledEvent: agent=${agentId} task=${taskId} challenger=${challenger}`,
    );

    try {
      const [challengePda] = this.solanaService.deriveChallengePda(
        new PublicKey(agentId),
        Buffer.from(event.taskId),
      );

      const challengeData: ChallengeCacheData = {
        id: challengePda.toBase58(),
        challengePda: challengePda.toBase58(),
        taskId,
        agentId,
        requester: challenger,
        status: 'disputed',
        capabilityName: 'unknown',
        parametersJson: '{}',
        disputeReason: `Challenge filed: ${event.failureType ?? 'unknown'}`,
        createdAt: event.filedAt ? Number(event.filedAt) * 1000 : Date.now(),
        updatedAt: Date.now(),
      };

      await this.challengesService.cacheChallenge(challengeData);
      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.DISPUTED,
        { disputeReason: challengeData.disputeReason },
      );
    } catch (error) {
      this.logger.error('Failed to handle ChallengeFiledEvent', error);
    }
  }

  private async handleChallengeDismissed(event: any) {
    const taskId = Buffer.from(event.taskId).toString('hex');
    const agentId = event.agent.toBase58();

    this.logger.log(`ChallengeDismissedEvent: agent=${agentId} task=${taskId}`);

    try {
      const [challengePda] = this.solanaService.deriveChallengePda(
        new PublicKey(agentId),
        Buffer.from(event.taskId),
      );

      await this.challengesService.updateChallenge(challengePda.toBase58(), {
        status: 'completed',
        completedAt: Date.now(),
      });
      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.COMPLETED,
        { completedAt: Date.now() },
      );
    } catch (error) {
      this.logger.error('Failed to handle ChallengeDismissedEvent', error);
    }
  }

  private async handleAdjudicationAgentSlashed(event: any) {
    const taskId = Buffer.from(event.taskId).toString('hex');
    const agentId = event.agent.toBase58();

    this.logger.log(
      `AgentSlashedEvent: agent=${agentId} task=${taskId} challenger=${event.challenger.toBase58()}`,
    );

    try {
      const [challengePda] = this.solanaService.deriveChallengePda(
        new PublicKey(agentId),
        Buffer.from(event.taskId),
      );

      await this.challengesService.updateChallenge(challengePda.toBase58(), {
        status: 'failed',
        completedAt: Date.now(),
      });
      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.FAILED,
        { completedAt: Date.now() },
      );
    } catch (error) {
      this.logger.error('Failed to handle AgentSlashedEvent', error);
    }
  }
}
