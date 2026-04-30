import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private nodeUrl: string;

  onModuleInit() {
    this.nodeUrl = process.env.IPFS_NODE_URL || 'http://localhost:3002';
    this.logger.log(`IPFS service configured. Node URL: ${this.nodeUrl}`);
  }

  async pinManifest(manifest: Record<string, unknown>): Promise<string> {
    let response: { data: { cid?: string } };
    try {
      response = await axios.post(`${this.nodeUrl}/pin`, { manifest });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'IPFS node request failed';
      throw new InternalServerErrorException(
        `IPFS pin failed: ${msg}. Is apps/ipfs running? (pnpm dev:ipfs)`,
      );
    }
    const cid = response.data?.cid;
    if (!cid)
      throw new InternalServerErrorException('IPFS node returned no CID.');
    this.logger.log(`Manifest pinned to IPFS: ${cid}`);
    return cid;
  }
}
