import { Controller, Get } from '@nestjs/common';

@Controller('verification')
export class VerificationController {
  /**
   * Health check
   * Verification is handled automatically by ReviewWorker
   * Manual verification endpoints moved to /admin
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'verification',
      timestamp: new Date().toISOString(),
    };
  }
}
