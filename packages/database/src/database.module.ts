import { Global, Module } from "@nestjs/common";
import { RocksDBService } from "./rocksdb.service";

@Global()
@Module({
  providers: [RocksDBService],
  exports: [RocksDBService],
})
export class DatabaseModule {}
