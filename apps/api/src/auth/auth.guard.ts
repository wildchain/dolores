import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing authentication token. Please login with your wallet.',
      );
    }

    const token = authHeader.substring(7);

    try {
      const payload = await this.authService.validateToken(token);
      request.user = { wallet: payload.wallet };
      return true;
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid or expired token. Please login again.',
      );
    }
  }
}
