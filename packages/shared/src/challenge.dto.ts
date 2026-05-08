/**
 * DTO for creating a challenge
 */
export interface CreateChallengeDto {
  taskId: string;
  violationHash: string;
  evidenceCid: string;
  verificationOutcome?: Record<string, unknown>;
}
