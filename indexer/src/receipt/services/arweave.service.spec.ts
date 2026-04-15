import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ArweaveService } from '@dolores/receipt/services/arweave.service';

describe('ArweaveService', () => {
  let service: ArweaveService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        ARWEAVE_HOST: 'arweave.net',
        ARWEAVE_PORT: 443,
        ARWEAVE_PROTOCOL: 'https',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArweaveService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ArweaveService>(ArweaveService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize Arweave client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
  });

  describe('wallet management', () => {
    it('should generate a wallet if none configured', async () => {
      await service.onModuleInit();
      const wallet = service.getWallet();
      expect(wallet).toBeDefined();
      expect(wallet.kty).toBe('RSA');
    });

    it('should load wallet from JSON environment variable', async () => {
      const mockWallet = {
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      };

      mockConfigService.get.mockImplementation((key) => {
        if (key === 'ARWEAVE_WALLET_JSON') {
          return JSON.stringify(mockWallet);
        }
        return undefined;
      });

      const newService = new ArweaveService(configService);
      await newService.onModuleInit();

      const wallet = newService.getWallet();
      expect(wallet.kty).toBe('RSA');
      expect(wallet.n).toBe('test-n');
    });
  });

  describe('getAddress', () => {
    it('should return wallet address', async () => {
      await service.onModuleInit();
      const address = await service.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });
  });

  describe('getBalance', () => {
    it('should return balance in AR', async () => {
      await service.onModuleInit();

      // Mock Arweave balance methods
      const client = service.getClient();
      const mockBalance = '1000000000000'; // Winston units
      const mockAddress = 'mock-arweave-address';

      jest.spyOn(client.wallets, 'jwkToAddress').mockResolvedValue(mockAddress);
      jest.spyOn(client.wallets, 'getBalance').mockResolvedValue(mockBalance);

      const balance = await service.getBalance();

      expect(balance).toBeDefined();
      expect(typeof balance).toBe('string');
    });
  });

  describe('upload', () => {
    it('should upload data and return transaction ID', async () => {
      await service.onModuleInit();

      // Mock Arweave transaction methods
      const mockTxId = 'mock-tx-id-123';
      const mockTransaction = {
        id: mockTxId,
        addTag: jest.fn(),
      };

      const client = service.getClient();
      jest
        .spyOn(client, 'createTransaction')
        .mockResolvedValue(mockTransaction as any);
      jest.spyOn(client.transactions, 'sign').mockResolvedValue(undefined);
      jest.spyOn(client.transactions, 'post').mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {},
      } as any);

      const data = JSON.stringify({ test: 'data' });
      const txId = await service.upload(data);

      expect(txId).toBe(mockTxId);
      expect(mockTransaction.addTag).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(mockTransaction.addTag).toHaveBeenCalledWith(
        'App-Name',
        'Dolores',
      );
      expect(mockTransaction.addTag).toHaveBeenCalledWith('App-Version', '1.0');
    });

    it('should throw error on upload failure', async () => {
      await service.onModuleInit();

      const client = service.getClient();
      const mockTransaction = {
        id: 'mock-id',
        addTag: jest.fn(),
      };

      jest
        .spyOn(client, 'createTransaction')
        .mockResolvedValue(mockTransaction as any);
      jest.spyOn(client.transactions, 'sign').mockResolvedValue(undefined);
      jest.spyOn(client.transactions, 'post').mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
      } as any);

      await expect(service.upload('test')).rejects.toThrow(
        'Failed to upload to Arweave',
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve data by transaction ID', async () => {
      await service.onModuleInit();

      const mockData = JSON.stringify({ test: 'retrieved' });
      const mockTransaction = {
        get: jest.fn().mockReturnValue(mockData),
      };

      const client = service.getClient();
      jest
        .spyOn(client.transactions, 'get')
        .mockResolvedValue(mockTransaction as any);

      const data = await service.retrieve('mock-tx-id');
      expect(data).toBe(mockData);
    });
  });

  describe('getStatus', () => {
    it('should get transaction status', async () => {
      await service.onModuleInit();

      const mockStatus = { confirmed: { block_height: 12345 } };
      const client = service.getClient();
      jest
        .spyOn(client.transactions, 'getStatus')
        .mockResolvedValue(mockStatus as any);

      const status = await service.getStatus('mock-tx-id');
      expect(status).toEqual(mockStatus);
    });
  });
});
