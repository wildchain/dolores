import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DATABASE_CONFIG } from '@dolores/lib/database';
import { ReceiptModule } from './receipt/receipt.module';
import { AgentModule } from '@dolores/agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(DATABASE_CONFIG),
    ReceiptModule,
    AgentModule,
  ],
})
export class AppModule { }