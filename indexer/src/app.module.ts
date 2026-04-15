import { Module } from '@nestjs/common';
import { AppController } from '@dolores/app.controller';
import { AppService } from '@dolores/app.service';
import { ReceiptModule } from '@dolores/receipt/receipt.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DATABASE_CONFIG } from '@dolores/lib/database';

@Module({
  imports: [ReceiptModule, TypeOrmModule.forRoot(DATABASE_CONFIG)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
