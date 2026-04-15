import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';

@Injectable()
export class ArweaveService implements OnModuleInit {
  private readonly logger = new Logger(ArweaveService.name);
  private arweave: Arweave;
  private wallet: JWKInterface;

  constructor(private readonly configService: ConfigService) {
    // Initialize Arweave client
    this.arweave = Arweave.init({
      host: this.configService.get<string>('ARWEAVE_HOST', 'arweave.net'),
      port: this.configService.get<number>('ARWEAVE_PORT', 443),
      protocol: this.configService.get<string>('ARWEAVE_PROTOCOL', 'https'),
    });
  }

  async onModuleInit() {
    await this.loadWallet();
  }

  private async loadWallet() {
    const walletPath = this.configService.get<string>('ARWEAVE_WALLET_PATH');
    const walletJson = this.configService.get<string>('ARWEAVE_WALLET_JSON');

    if (walletJson) {
      // Load from environment variable (JSON string)
      this.wallet = JSON.parse(walletJson);
      this.logger.log('Arweave wallet loaded from environment');
    } else if (walletPath) {
      // Load from file path
      const fs = await import('fs/promises');
      const walletData = await fs.readFile(walletPath, 'utf-8');
      this.wallet = JSON.parse(walletData);
      this.logger.log(`Arweave wallet loaded from ${walletPath}`);
    } else {
      // Generate new wallet for development
      this.wallet = await this.arweave.wallets.generate();
      this.logger.warn(
        'No wallet configured. Generated temporary wallet (development only)',
      );
      const address = await this.arweave.wallets.jwkToAddress(this.wallet);
      this.logger.warn(`Arweave address: ${address}`);
    }
  }

  async getBalance(): Promise<string> {
    const address = await this.arweave.wallets.jwkToAddress(this.wallet);
    const balance = await this.arweave.wallets.getBalance(address);
    return this.arweave.ar.winstonToAr(balance);
  }

  async getAddress(): Promise<string> {
    return this.arweave.wallets.jwkToAddress(this.wallet);
  }

  getClient(): Arweave {
    return this.arweave;
  }

  getWallet(): JWKInterface {
    return this.wallet;
  }

  /**
   * Upload data to Arweave and return transaction ID
   */
  async upload(data: string | Buffer): Promise<string> {
    const transaction = await this.arweave.createTransaction(
      {
        data: typeof data === 'string' ? data : data.toString(),
      },
      this.wallet,
    );

    // Add tags for categorization
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'Dolores');
    transaction.addTag('App-Version', '1.0');

    await this.arweave.transactions.sign(transaction, this.wallet);
    const response = await this.arweave.transactions.post(transaction);

    if (response.status === 200) {
      this.logger.log(`Uploaded to Arweave: ${transaction.id}`);
      return transaction.id;
    } else {
      throw new Error(
        `Failed to upload to Arweave: ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Retrieve data from Arweave by transaction ID
   */
  async retrieve(txId: string): Promise<string> {
    const transaction = await this.arweave.transactions.get(txId);
    const data = transaction.get('data', { decode: true, string: true });
    return data as string;
  }

  /**
   * Get transaction status
   */
  async getStatus(txId: string) {
    return this.arweave.transactions.getStatus(txId);
  }
}
