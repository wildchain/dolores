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
import { ChallengesService } from '../challenges/challenges.service';
import { TaskStatus } from '@dolores/shared';
import { AgentCacheData } from '../agents/agent-cache.entity';
import { TaskCacheData } from '../tasks/task-cache.entity';
import { ChallengeCacheData } from '../challenges/challenge-cache.entity';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private listenerIds: number[] = [];
  private registryLogSubscriptionId: number | null = null;

  constructor(
    private solanaService: SolanaService,
    private agentsService: AgentsService,
    private tasksService: TasksService,
    private challengesService: ChallengesService,
  ) { }

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

      // Listen to Registry events using connection.onLogs
      this.logger.log(
        `Starting Registry log listener for program: ${registryProgram.programId.toBase58()}`,
      );
      this.registryLogSubscriptionId = connection.onLogs(
        registryProgram.programId,
        (logInfo) => {
          this.logger.log('New Registry Transaction Detected');
          this.logger.log(
            `Signature: ${logInfo.signature}, Logs: ${logInfo.logs.length} entries`,
          );

          // Skip invalid signatures
          if (logInfo.signature.includes('111111')) return;

          // Check for AgentRegistered event
          const isAgentRegistered = logInfo?.logs?.some((log: string) =>
            log.includes('AgentRegistered'),
          );
          if (isAgentRegistered) {
            this.logger.log(
              `AgentRegistered event detected: ${logInfo.signature}`,
            );
            this.handleRegistryTransactionLog(logInfo, 'AgentRegistered');
            return;
          }

          // Check for AgentDeactivated event
          const isAgentDeactivated = logInfo?.logs?.some((log: string) =>
            log.includes('AgentDeactivated'),
          );
          if (isAgentDeactivated) {
            this.logger.log(
              `AgentDeactivated event detected: ${logInfo.signature}`,
            );
            this.handleRegistryTransactionLog(logInfo, 'AgentDeactivated');
            return;
          }

          // Check for AgentReactivated event
          const isAgentReactivated = logInfo?.logs?.some((log: string) =>
            log.includes('AgentReactivated'),
          );
          if (isAgentReactivated) {
            this.logger.log(
              `AgentReactivated event detected: ${logInfo.signature}`,
            );
            this.handleRegistryTransactionLog(logInfo, 'AgentReactivated');
            return;
          }

          // Log any other registry program transactions
          this.logger.log(
            `Other Registry transaction detected: ${logInfo.signature}`,
          );

          (async () => {
            try {
              const conn = this.solanaService.getConnection();
              const tx = await conn.getTransaction(logInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });
              if (tx?.transaction?.message?.staticAccountKeys) {
                const keys = tx.transaction.message.staticAccountKeys;
                if (keys.length > 1) {
                  const candidate = keys[1].toBase58();
                  this.agentsService.refreshAgentFromSolana(candidate).catch(() => { });
                }
              }
            } catch { /* best-effort */ }
          })();
        },
      );

      // Listen to Fund events
      const fundCreatedListenerId = fundProgram.addEventListener(
        'FundCreated',
        async (event: any) => {
          await this.handleFundCreated(event);
        },
      );
      this.listenerIds.push(fundCreatedListenerId);

      const stakeAddedListenerId = fundProgram.addEventListener(
        'Staked',
        async (event: any) => {
          await this.handleStakeAdded(event);
        },
      );
      this.listenerIds.push(stakeAddedListenerId);

      const stakeWithdrawnListenerId = fundProgram.addEventListener(
        'StakeWithdrawn',
        async (event: any) => {
          await this.handleStakeWithdrawn(event);
        },
      );
      this.listenerIds.push(stakeWithdrawnListenerId);

      // Listen to Adjudication events
      const taskRegisteredListenerId = adjudicationProgram.addEventListener(
        'TaskRegistered',
        async (event: any) => {
          await this.handleTaskRegistered(event);
        },
      );
      this.listenerIds.push(taskRegisteredListenerId);

      const challengeFiledListenerId = adjudicationProgram.addEventListener(
        'ChallengeFiled',
        async (event: any) => {
          await this.handleChallengeFiled(event);
        },
      );
      this.listenerIds.push(challengeFiledListenerId);

      const autoApprovedListenerId = adjudicationProgram.addEventListener(
        'AutoApproved',
        async (event: any) => {
          await this.handleAutoApproved(event);
        },
      );
      this.listenerIds.push(autoApprovedListenerId);

      const autoRejectedListenerId = adjudicationProgram.addEventListener(
        'AutoRejected',
        async (event: any) => {
          await this.handleAutoRejected(event);
        },
      );
      this.listenerIds.push(autoRejectedListenerId);

      const disputeInitiatedListenerId = adjudicationProgram.addEventListener(
        'DisputeInitiated',
        async (event: any) => {
          await this.handleDisputeInitiated(event);
        },
      );
      this.listenerIds.push(disputeInitiatedListenerId);

      const disputeResolvedListenerId = adjudicationProgram.addEventListener(
        'DisputeResolved',
        async (event: any) => {
          await this.handleDisputeResolved(event);
        },
      );
      this.listenerIds.push(disputeResolvedListenerId);

      const stakeSlashedListenerId = adjudicationProgram.addEventListener(
        'StakeSlashed',
        async (event: any) => {
          await this.handleStakeSlashed(event);
        },
      );
      this.listenerIds.push(stakeSlashedListenerId);

      const attestationSubmittedListenerId = registryProgram.addEventListener(
        'AttestationSubmitted',
        async (event: any) => {
          const agentId = event.agent.toBase58();
          this.logger.log(`AttestationSubmitted: ${agentId} — refreshing cache`);
          await this.agentsService.refreshAgentFromSolana(agentId).catch(err =>
            this.logger.warn(`Failed to refresh after attestation: ${err?.message}`)
          );
        },
      );
      this.listenerIds.push(attestationSubmittedListenerId);

      const slashRecordedListenerId = registryProgram.addEventListener(
        'AgentSlashed',
        async (event: any) => {
          const agentId = event.agent.toBase58();
          this.logger.log(`AgentSlashed on-chain: ${agentId} — refreshing cache`);
          await this.agentsService.refreshAgentFromSolana(agentId).catch(() => { });
        },
      );
      this.listenerIds.push(slashRecordedListenerId);

      this.logger.log(`Started ${this.listenerIds.length} event listeners`);
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
      const registryProgram = this.solanaService.getRegistryProgram();
      const fundProgram = this.solanaService.getFundProgram();
      const adjudicationProgram = this.solanaService.getAdjudicationProgram();

      // Remove registry log listener
      if (this.registryLogSubscriptionId !== null) {
        await connection.removeOnLogsListener(this.registryLogSubscriptionId);
        this.logger.log(
          `Removed registry log listener: ${this.registryLogSubscriptionId}`,
        );
      }

      // Remove other event listeners
      for (const id of this.listenerIds) {
        await Promise.allSettled([
          registryProgram.removeEventListener(id),
          fundProgram.removeEventListener(id),
          adjudicationProgram.removeEventListener(id),
        ]);

      }

      this.logger.log('Stopped all event listeners');
    } catch (error) {
      this.logger.error('Failed to stop event listeners', error);
    }
  }

  // Event handlers

  /**
   * Handle registry transaction logs
   */
  private async handleRegistryTransactionLog(
    logInfo: any,
    eventType: 'AgentRegistered' | 'AgentDeactivated' | 'AgentReactivated',
  ) {
    try {
      this.logger.log(`Processing ${eventType} from transaction log`);
      this.logger.log(`Transaction Signature: ${logInfo.signature}`);

      // Fetch full transaction to extract the agent pubkey
      const connection = this.solanaService.getConnection();
      const tx = await connection.getTransaction(logInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (tx?.transaction?.message?.staticAccountKeys) {
        const registryProgramId = this.solanaService.getRegistryProgram().programId.toBase58();
        // The agent pubkey is typically account index 1 in registry transactions
        const accounts = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
        this.logger.log(`Transaction accounts: ${accounts.slice(0, 4).join(', ')}`);
      }

      this.logger.log(`${eventType} event logged successfully`);
    } catch (error) {
      this.logger.error(`Failed to handle ${eventType} transaction log`, error);
    }
  }

  private async handleAgentRegistered(event: any) {
    this.logger.log(`AgentRegistered: ${event.agent.toBase58()}`);
    // Fetch and cache agent data
    try {
      const agentDetails = await this.agentsService.getAgentDetails(
        event.agent.toBase58(),
      );
      this.logger.log(`Cached agent: ${agentDetails.name}`);
    } catch (error) {
      this.logger.error('Failed to cache registered agent', error);
    }
  }

  private async handleAgentDeactivated(event: any) {
    this.logger.log(`AgentDeactivated: ${event.agent.toBase58()}`);
    await this.agentsService.refreshAgentFromSolana(event.agent.toBase58()).catch(() => { });
  }

  private async handleAgentReactivated(event: any) {
    this.logger.log(`AgentReactivated: ${event.agent.toBase58()}`);
    await this.agentsService.refreshAgentFromSolana(event.agent.toBase58()).catch(() => { });
  }

  private async handleFundCreated(event: any) {
    this.logger.log(`FundCreated: ${event.agent.toBase58()}`);
    // Refresh agent cache to get fund details
    try {
      await this.agentsService.getAgentDetails(event.agent.toBase58());
    } catch (error) {
      this.logger.error('Failed to update agent fund details', error);
    }
  }

  private async handleStakeAdded(event: any) {
    const agentId = event.agent.toBase58();
    this.logger.log(`StakeAdded: ${agentId} — ${event.amount}`);

    // Re-fetch agent from Solana to get updated stake + reputation
    await this.agentsService.refreshAgentFromSolana(agentId).catch(err =>
      this.logger.warn(`Failed to refresh agent ${agentId} after stake: ${err?.message}`)
    );
  }

  private async handleStakeWithdrawn(event: any) {
    const agentId = event.agent.toBase58();
    this.logger.log(`StakeWithdrawn: ${agentId} — ${event.amount}`);
    await this.agentsService.refreshAgentFromSolana(agentId).catch(() => { });
  }
  private async handleTaskRegistered(event: any) {
    this.logger.log(
      `TaskRegistered: Agent ${event.agent.toBase58()}, Task ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Cache new task
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();
      const requester = event.requester.toBase58();

      // Derive challenge PDA
      const [challengePda] = this.solanaService.deriveChallengePda(
        new PublicKey(agentId),
        Buffer.from(event.taskId),
      );

      const taskData: TaskCacheData = {
        id: taskId, // Use task ID as entity ID
        taskId,
        challengePda: challengePda.toBase58(),
        agentId,
        agentName: 'Loading...', // TODO: Fetch from agent cache
        requester,
        status: 'pending',
        capabilityName: event.capabilityName || 'unknown',
        parametersJson: event.parametersJson || '{}',
        stakeAmount: event.stakeAmount?.toNumber() || 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.tasksService.cacheTask(taskData);
      this.logger.log(`Cached task: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to cache registered task', error);
    }
  }

  private async handleChallengeFiled(event: any) {
    this.logger.log(
      `ChallengeFiled: ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Update task with receipt
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();
      const receiptUrl = `https://arweave.net/${event.receiptCid}`;

      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.PENDING,
        {
          receiptUrl,
        },
      );

      this.logger.log(`Updated task with receipt: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to update task with receipt', error);
    }
  }

  private async handleAutoApproved(event: any) {
    this.logger.log(
      `AutoApproved: ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Update task status to completed
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();

      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.COMPLETED,
        {
          completedAt: Date.now(),
        },
      );

      this.logger.log(`Task auto-approved: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to update auto-approved task', error);
    }
  }

  private async handleAutoRejected(event: any) {
    this.logger.log(
      `AutoRejected: ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Update task status to failed
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();

      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.FAILED,
        {
          completedAt: Date.now(),
        },
      );

      this.logger.log(`Task auto-rejected: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to update auto-rejected task', error);
    }
  }

  private async handleDisputeInitiated(event: any) {
    this.logger.log(
      `DisputeInitiated: ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Update task status to disputed
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();

      await this.tasksService.updateTaskStatus(
        agentId,
        taskId,
        TaskStatus.DISPUTED,
        {
          disputeReason: event.reason || 'Dispute initiated',
        },
      );

      this.logger.log(`Task disputed: ${taskId}`);
    } catch (error) {
      this.logger.error('Failed to update disputed task', error);
    }
  }

  private async handleDisputeResolved(event: any) {
    this.logger.log(
      `DisputeResolved: ${Buffer.from(event.taskId).toString('hex')}`,
    );

    // Update task with adjudication result
    try {
      const taskId = Buffer.from(event.taskId).toString('hex');
      const agentId = event.agent.toBase58();
      const status = event.approved ? TaskStatus.COMPLETED : TaskStatus.FAILED;

      await this.tasksService.updateTaskStatus(agentId, taskId, status, {
        adjudicatedBy: event.adjudicator?.toBase58(),
        adjudicatedAt: Date.now(),
        completedAt: Date.now(),
      });

      this.logger.log(`Dispute resolved: ${taskId} - ${status}`);
    } catch (error) {
      this.logger.error('Failed to update resolved dispute', error);
    }
  }

  private async handleStakeSlashed(event: any) {
    const agentId = event.agent.toBase58();
    this.logger.log(`StakeSlashed: ${agentId} — ${event.amount}`);
    await this.agentsService.refreshAgentFromSolana(agentId).catch(() => { });
  }
}
