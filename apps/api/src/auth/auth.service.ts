import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PublicKey } from '@solana/web3.js';
import * as crypto from 'crypto';
import { verifySignature } from '@dolores/solana-utils';
import bs58 from 'bs58';

interface Challenge {
  nonce: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private challenges = new Map<string, Challenge>();

  constructor(private jwtService: JwtService) {}

  /**
   * Generate authentication challenge for a wallet
   */
  generateChallenge(walletAddress: string): {
    message: string;
    nonce: string;
  } {
    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    this.challenges.set(walletAddress, { nonce, expiresAt });

    const message = `Sign this message to authenticate with Dolores:\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

    return { message, nonce };
  }

  /**
   * Verify signature and issue JWT token
   */
  async verifyAndIssueToken(
    wallet: string,
    message: string,
    signature: string,
  ): Promise<{ token: string; wallet: string; expiresAt: number }> {
    // Validate wallet address format
    try {
      bs58.decode(wallet);
    } catch {
      throw new BadRequestException('Invalid wallet address format');
    }

    // Check challenge exists
    const challenge = this.challenges.get(wallet);
    if (!challenge) {
      throw new UnauthorizedException(
        'No challenge found for this wallet. Request a new challenge.',
      );
    }

    // Check not expired
    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(wallet);
      throw new UnauthorizedException(
        'Challenge expired. Request a new challenge.',
      );
    }

    // Verify nonce is in message
    if (!message.includes(challenge.nonce)) {
      throw new UnauthorizedException('Invalid challenge nonce');
    }

    // Verify Ed25519 signature
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const walletPublicKey = new PublicKey(wallet);

      const isValid = verifySignature(
        messageBytes,
        signatureBytes,
        walletPublicKey,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        `Signature verification failed: ${error.message}`,
      );
    }

    // Clean up challenge
    this.challenges.delete(wallet);

    // Issue JWT token
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const token = this.jwtService.sign({
      wallet,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt / 1000),
    });

    return { token, wallet, expiresAt };
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<{ wallet: string }> {
    try {
      const payload = this.jwtService.verify(token);
      return { wallet: payload.wallet };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Clean up expired challenges
   */
  private cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [wallet, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(wallet);
      }
    }
  }
}
