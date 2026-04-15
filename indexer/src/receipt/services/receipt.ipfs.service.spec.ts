import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptIpfsService } from './receipt.ipfs.service';
import { ArweaveService } from './arweave.service';
import { ExecutionReceipt } from '../interfaces/execution-receipt.interface';

describe('ReceiptIpfsService', () => {
  let service: ReceiptIpfsService;
  let arweaveService: ArweaveService;

  const mockExecutionReceipt: ExecutionReceipt = {
    schema_version: '1.0',
    task_id: 'task-123',
    agent_id: 'agent-pubkey-456',
    operator: 'operator-pubkey-789',
    assigned_by: 'trader-pubkey-abc',
    timestamp_unix: 1743724800,
    execution: {
      tx_signatures: ['5Kj8xVmN3...', '9xQeWvG81...'],
      programs_called: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
      instructions_executed: ['swap', 'route_swap'],
      token_transfers: [
        { mint: 'EPjFWdd5...', amount: 1000000, direction: 'out' },
        { mint: 'So111111...', amount: 5230000, direction: 'in' },
      ],
    },
    result: {
      status: 'success',
      summary: 'Swapped 1 USDC for 0.00523 SOL at 191.2 USDC/SOL',
    },
  };

  const mockArweaveService = {
    upload: jest.fn(),
    retrieve: jest.fn(),
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptIpfsService,
        {
          provide: ArweaveService,
          useValue: mockArweaveService,
        },
      ],
    }).compile();

    service = module.get<ReceiptIpfsService>(ReceiptIpfsService);
    arweaveService = module.get<ArweaveService>(ArweaveService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeOutputHash', () => {
    it('should compute deterministic SHA-256 hash', () => {
      const hash1 = service.computeOutputHash(mockExecutionReceipt);
      const hash2 = service.computeOutputHash(mockExecutionReceipt);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should produce different hashes for different receipts', () => {
      const receipt2 = { ...mockExecutionReceipt, task_id: 'different-task' };

      const hash1 = service.computeOutputHash(mockExecutionReceipt);
      const hash2 = service.computeOutputHash(receipt2);

      expect(hash1).not.toBe(hash2);
    });

    it('should canonicalize JSON (sort keys)', () => {
      const unsortedReceipt = {
        result: mockExecutionReceipt.result,
        task_id: mockExecutionReceipt.task_id,
        agent_id: mockExecutionReceipt.agent_id,
        schema_version: mockExecutionReceipt.schema_version,
        execution: mockExecutionReceipt.execution,
        operator: mockExecutionReceipt.operator,
        assigned_by: mockExecutionReceipt.assigned_by,
        timestamp_unix: mockExecutionReceipt.timestamp_unix,
      };

      const hash1 = service.computeOutputHash(mockExecutionReceipt);
      const hash2 = service.computeOutputHash(
        unsortedReceipt as ExecutionReceipt,
      );

      // Should produce same hash regardless of key order
      expect(hash1).toBe(hash2);
    });
  });

  describe('pinReceiptToIpfs', () => {
    it('should upload receipt to Arweave and return CID', async () => {
      const mockCid = 'arweave-tx-id-abc123';
      mockArweaveService.upload.mockResolvedValue(mockCid);

      const cid = await service.pinReceiptToIpfs(mockExecutionReceipt);

      expect(cid).toBe(mockCid);
      expect(mockArweaveService.upload).toHaveBeenCalledWith(
        expect.stringContaining(mockExecutionReceipt.task_id),
      );
    });

    it('should upload canonical JSON', async () => {
      const mockCid = 'arweave-tx-id-xyz';
      mockArweaveService.upload.mockResolvedValue(mockCid);

      await service.pinReceiptToIpfs(mockExecutionReceipt);

      const uploadedData = mockArweaveService.upload.mock.calls[0][0];
      const parsed = JSON.parse(uploadedData);

      expect(parsed.task_id).toBe(mockExecutionReceipt.task_id);
      expect(parsed.agent_id).toBe(mockExecutionReceipt.agent_id);
    });

    it('should throw error on upload failure', async () => {
      mockArweaveService.upload.mockRejectedValue(new Error('Network error'));

      await expect(
        service.pinReceiptToIpfs(mockExecutionReceipt),
      ).rejects.toThrow('Failed to pin receipt to Arweave');
    });
  });

  describe('retrieveReceipt', () => {
    it('should retrieve and parse receipt from Arweave', async () => {
      const mockCid = 'arweave-tx-id-retrieved';
      mockArweaveService.retrieve.mockResolvedValue(
        JSON.stringify(mockExecutionReceipt),
      );

      const receipt = await service.retrieveReceipt(mockCid);

      expect(receipt).toEqual(mockExecutionReceipt);
      expect(mockArweaveService.retrieve).toHaveBeenCalledWith(mockCid);
    });

    it('should throw error on retrieval failure', async () => {
      const mockCid = 'invalid-cid';
      mockArweaveService.retrieve.mockRejectedValue(new Error('Not found'));

      await expect(service.retrieveReceipt(mockCid)).rejects.toThrow(
        'Failed to retrieve receipt from Arweave',
      );
    });
  });

  describe('verifyReceipt', () => {
    it('should return true for valid receipt hash', async () => {
      const mockCid = 'valid-cid';
      const expectedHash = service.computeOutputHash(mockExecutionReceipt);

      mockArweaveService.retrieve.mockResolvedValue(
        JSON.stringify(mockExecutionReceipt),
      );

      const isValid = await service.verifyReceipt(mockCid, expectedHash);

      expect(isValid).toBe(true);
    });

    it('should return false for mismatched hash', async () => {
      const mockCid = 'tampered-cid';
      const wrongHash = 'abc123wronghash';

      mockArweaveService.retrieve.mockResolvedValue(
        JSON.stringify(mockExecutionReceipt),
      );

      const isValid = await service.verifyReceipt(mockCid, wrongHash);

      expect(isValid).toBe(false);
    });

    it('should return false on retrieval error', async () => {
      const mockCid = 'error-cid';
      mockArweaveService.retrieve.mockRejectedValue(new Error('Network error'));

      const isValid = await service.verifyReceipt(mockCid, 'any-hash');

      expect(isValid).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should forward status request to ArweaveService', async () => {
      const mockCid = 'status-cid';
      const mockStatus = { confirmed: { block_height: 12345 } };
      mockArweaveService.getStatus.mockResolvedValue(mockStatus);

      const status = await service.getStatus(mockCid);

      expect(status).toEqual(mockStatus);
      expect(mockArweaveService.getStatus).toHaveBeenCalledWith(mockCid);
    });
  });
});
