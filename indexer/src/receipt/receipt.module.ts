import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ReceiptController } from '@dolores/receipt/receipt.controller';
import { ReceiptService } from '@dolores/receipt/receipt.service';
import { ReceiptEntity } from '@dolores/receipt/receipt.entity';
import { ReceiptIpfsService } from '@dolores/receipt/services/receipt.ipfs.service';
import { ArweaveService } from '@dolores/receipt/services/arweave.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReceiptEntity]), ConfigModule],
  controllers: [ReceiptController],
  providers: [ReceiptService, ReceiptIpfsService, ArweaveService],
  exports: [ReceiptService, ReceiptIpfsService],
})
export class ReceiptModule {}
