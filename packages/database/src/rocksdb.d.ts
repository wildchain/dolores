declare module "rocksdb" {
  interface RocksDB {
    open(options: object, cb: (err: Error | null) => void): void;
    close(cb: (err: Error | null) => void): void;
    get(key: string, cb: (err: Error | null, value: Buffer) => void): void;
    get(
      key: string,
      options: object,
      cb: (err: Error | null, value: Buffer) => void,
    ): void;
    put(
      key: string,
      value: string | Buffer,
      cb: (err: Error | null) => void,
    ): void;
    put(
      key: string,
      value: string | Buffer,
      options: object,
      cb: (err: Error | null) => void,
    ): void;
    del(key: string, cb: (err: Error | null) => void): void;
    del(key: string, options: object, cb: (err: Error | null) => void): void;
    iterator(options?: object): {
      next(cb: (err: Error | null, key: Buffer, value: Buffer) => void): void;
      end(cb: (err: Error | null) => void): void;
    };
  }

  function rocksdb(location: string): RocksDB;
  export = rocksdb;
}
