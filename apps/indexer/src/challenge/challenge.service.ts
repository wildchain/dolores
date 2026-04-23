import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RocksDBService } from '@dolores/database';
import { AttestationService } from '@dolores/attestation/attestation.service';
import { ReceiptService } from '@dolores/receipt';
import { CreateChallengeDto } from '@dolores/shared';
import {
  ChallengeEntity,
  ChallengeStatus,
  getChallengeKey,
  getChallengeByAgentKey,
  getChallengeByReviewerKey,
  CHALLENGE_PREFIX,
} from './challenge.entity';
import { createEntity } from '@dolores/database';

// Re-export for backward compatibility
export { CreateChallengeDto };

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    private readonly db: RocksDBService,
    private readonly receiptService: ReceiptService,
    private readonly attestationService: AttestationService,
  ) {}

  async submitChallenge(dto: CreateChallengeDto): Promise<ChallengeEntity> {
    const receipt = await this.receiptService.findByTaskId(dto.taskId);
    if (!receipt) {
      throw new NotFoundException(
        `Receipt not found for taskId: ${dto.taskId}`,
      );
    }

    if (!receipt.pendingAttestationPda) {
      throw new NotFoundException(
        `Receipt ${dto.taskId} does not have a pending attestation on-chain`,
      );
    }

    const challengeTx = await this.attestationService.challengeAttestation(
      receipt,
      dto.violationHash,
      dto.evidenceCid,
    );

    const reviewerId = this.attestationService.getReviewerPublicKey();
    const status = challengeTx
      ? ChallengeStatus.Submitted
      : ChallengeStatus.Failed;

    const challenge = createEntity<ChallengeEntity>(receipt.taskId, {
      taskId: receipt.taskId,
      agentId: receipt.agentId,
      reviewerId,
      pendingAttestationPda: receipt.pendingAttestationPda,
      violationHash: dto.violationHash,
      evidenceCid: dto.evidenceCid,
      challengeTx: challengeTx ?? undefined,
      status,
    });

    // Store in multiple indexes
    await this.db.batch([
      { type: 'put', key: getChallengeKey(challenge.taskId), value: challenge },
      {
        type: 'put',
        key: getChallengeByAgentKey(challenge.agentId, challenge.taskId),
        value: challenge,
      },
      {
        type: 'put',
        key: getChallengeByReviewerKey(challenge.reviewerId, challenge.taskId),
        value: challenge,
      },
    ]);

    if (challengeTx) {
      await this.receiptService.markSlashed(
        receipt.taskId,
        challengeTx,
        reviewerId,
        dto.verificationOutcome,
      );
      this.logger.log(
        `Challenge submitted for task ${receipt.taskId}: ${challengeTx}`,
      );
    }

    return challenge;
  }

  async listChallenges(): Promise<ChallengeEntity[]> {
    const results = await this.db.scan<ChallengeEntity>({
      prefix: CHALLENGE_PREFIX,
    });
    return results
      .map((r) => r.value)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}
