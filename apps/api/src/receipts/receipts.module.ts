import { Module } from '@nestjs/common';
import { DatabaseModule } from '@dolores/database';
import { IpfsModule } from '../ipfs/ipfs.module';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';

@Module({
  imports: [DatabaseModule, IpfsModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}
