import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { ReceiptEntity } from './receipt.entity';
import { ReceiptIpfsService } from './services/receipt.ipfs.service';
import { ArweaveService } from './services/arweave.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReceiptEntity]), ConfigModule],
  controllers: [ReceiptController],
  providers: [ReceiptService, ReceiptIpfsService, ArweaveService],
  exports: [ReceiptService, ReceiptIpfsService],
})
export class ReceiptModule {}
