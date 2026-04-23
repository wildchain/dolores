import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';

class VerifySignatureDto {
  wallet: string;
  message: string;
  signature: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Get authentication challenge for a wallet
   */
  @Get('challenge/:wallet')
  getChallenge(@Param('wallet') wallet: string) {
    return this.authService.generateChallenge(wallet);
  }

  /**
   * Verify signature and issue JWT token
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifySignature(@Body() dto: VerifySignatureDto) {
    return this.authService.verifyAndIssueToken(
      dto.wallet,
      dto.message,
      dto.signature,
    );
  }
}
