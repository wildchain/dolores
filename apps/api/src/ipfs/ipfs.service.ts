import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHelia, Helia } from 'helia';
import { json, type JSON as HeliaJSON } from '@helia/json';
import { FsBlockstore } from 'blockstore-fs';

@Injectable()
export class IpfsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpfsService.name);
  private helia: Helia;
  private j: HeliaJSON;

  async onModuleInit() {
    const dataDir = process.env.IPFS_DATA_DIR || './data/ipfs';
    const blockstore = new FsBlockstore(dataDir);

    this.helia = await createHelia({ blockstore });
    this.j = json(this.helia);

    this.logger.log(`IPFS node started. Blockstore: ${dataDir}`);
  }

  async onModuleDestroy() {
    await this.helia?.stop();
    this.logger.log('IPFS node stopped.');
  }

  async pinManifest(manifest: Record<string, unknown>): Promise<string> {
    if (!this.helia) {
      throw new InternalServerErrorException('IPFS node is not initialised.');
    }

    const cid = await this.j.add(manifest);
    const cidStr = cid.toString();

    this.logger.log(`Manifest pinned to IPFS: ${cidStr}`);
    return cidStr;
  }
}
