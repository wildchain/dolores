import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { ReceiptEntity } from './receipt.entity';
import { AttestationModule } from '../attestation/attestation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReceiptEntity]),
    AttestationModule,
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule { }