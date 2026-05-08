import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import rocksdb from "rocksdb";
import * as path from "path";
import * as fs from "fs";

export interface RocksDBOptions {
  createIfMissing?: boolean;
  errorIfExists?: boolean;
  compression?: boolean;
  cacheSize?: number;
  writeBufferSize?: number;
  blockSize?: number;
  maxOpenFiles?: number;
  blockRestartInterval?: number;
}

@Injectable()
export class RocksDBService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RocksDBService.name);
  private db: any;
  private dbPath: string;
  private isReady = false;

  constructor() {
    const dataDir =
      process.env.ROCKSDB_PATH || path.join(process.cwd(), "data");
    this.dbPath = path.join(dataDir, "dolores.db");

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async onModuleInit() {
    await this.open();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options: RocksDBOptions = {
        createIfMissing: true,
        errorIfExists: false,
        compression: true,
        cacheSize: 8 * 1024 * 1024, // 8MB
        writeBufferSize: 4 * 1024 * 1024, // 4MB
        blockSize: 4096,
        maxOpenFiles: 1000,
        blockRestartInterval: 16,
      };

      this.db = rocksdb(this.dbPath);
      this.db.open(options, (err: Error) => {
        if (err) {
          this.logger.error(`Failed to open RocksDB at ${this.dbPath}`, err);
          reject(err);
        } else {
          this.isReady = true;
          this.logger.log(`RocksDB opened successfully at ${this.dbPath}`);
          resolve();
        }
      });
    });
  }

  private async close(): Promise<void> {
    if (!this.db || !this.isReady) return;

    return new Promise((resolve, reject) => {
      this.db.close((err: Error) => {
        if (err) {
          this.logger.error("Failed to close RocksDB", err);
          reject(err);
        } else {
          this.isReady = false;
          this.logger.log("RocksDB closed successfully");
          resolve();
        }
      });
    });
  }

  async put(key: string, value: any): Promise<void> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      const serialized = JSON.stringify(value);
      this.db.put(key, serialized, (err: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      this.db.get(key, (err: Error, value: string) => {
        if (err) {
          if (err.message.includes("NotFound")) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          try {
            resolve(JSON.parse(value));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      this.db.del(key, (err: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getMany<T = any>(prefix: string): Promise<T[]> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      const results: T[] = [];
      const iterator = this.db.iterator({
        gte: prefix,
        lte: prefix + "\xFF",
      });

      const next = () => {
        iterator.next((err: Error, key: string, value: string) => {
          if (err) {
            iterator.end(() => reject(err));
          } else if (key === undefined && value === undefined) {
            // End of iteration
            iterator.end(() => resolve(results));
          } else {
            try {
              results.push(JSON.parse(value));
              next();
            } catch (parseErr) {
              iterator.end(() => reject(parseErr));
            }
          }
        });
      };

      next();
    });
  }

  async scan<T = any>(options: {
    prefix?: string;
    gte?: string;
    lte?: string;
    limit?: number;
    reverse?: boolean;
  }): Promise<Array<{ key: string; value: T }>> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      const results: Array<{ key: string; value: T }> = [];
      const iteratorOptions: any = {};

      if (options.prefix) {
        iteratorOptions.gte = options.prefix;
        iteratorOptions.lte = options.prefix + "\xFF";
      } else {
        if (options.gte) iteratorOptions.gte = options.gte;
        if (options.lte) iteratorOptions.lte = options.lte;
      }

      if (options.reverse) {
        iteratorOptions.reverse = true;
      }

      const iterator = this.db.iterator(iteratorOptions);
      let count = 0;

      const next = () => {
        if (options.limit && count >= options.limit) {
          iterator.end(() => resolve(results));
          return;
        }

        iterator.next((err: Error, key: string, value: string) => {
          if (err) {
            iterator.end(() => reject(err));
          } else if (key === undefined && value === undefined) {
            iterator.end(() => resolve(results));
          } else {
            try {
              results.push({ key, value: JSON.parse(value) });
              count++;
              next();
            } catch (parseErr) {
              iterator.end(() => reject(parseErr));
            }
          }
        });
      };

      next();
    });
  }

  async batch(
    operations: Array<{ type: "put" | "del"; key: string; value?: any }>,
  ): Promise<void> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      const batch = this.db.batch();

      for (const op of operations) {
        if (op.type === "put") {
          batch.put(op.key, JSON.stringify(op.value));
        } else {
          batch.del(op.key);
        }
      }

      batch.write((err: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get all keys matching a prefix
   */
  async keys(prefix: string): Promise<string[]> {
    if (!this.isReady) throw new Error("RocksDB not ready");

    return new Promise((resolve, reject) => {
      const keys: string[] = [];
      const iterator = this.db.iterator({
        gte: prefix,
        lte: prefix + "\xFF",
        keys: true,
        values: false,
      });

      const next = () => {
        iterator.next((err: Error, key: string) => {
          if (err) {
            iterator.end(() => reject(err));
          } else if (key === undefined) {
            // End of iteration
            iterator.end(() => resolve(keys));
          } else {
            keys.push(key);
            next();
          }
        });
      };

      next();
    });
  }

  isConnected(): boolean {
    return this.isReady;
  }
}
