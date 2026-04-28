import { Module, forwardRef } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { AttestationModule } from '../attestation/attestation.module';
import { RocksDBService } from '@dolores/database';

@Module({
  imports: [AttestationModule],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
