import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ReceiptController } from '@dolores/receipt/receipt.controller';
import { ReceiptService } from '@dolores/receipt/receipt.service';
import { ReceiptIpfsService } from '@dolores/receipt/services/receipt.ipfs.service';
import { ReceiptEntity } from '@dolores/receipt/receipt.entity';
import { ExecutionReceipt } from '@dolores/receipt/interfaces/execution-receipt.interface';

describe('ReceiptController', () => {
  let controller: ReceiptController;
  let receiptService: ReceiptService;
  let ipfsService: ReceiptIpfsService;

  const mockExecutionReceipt: ExecutionReceipt = {
    schema_version: '1.0',
    task_id: 'task-123',
    agent_id: 'agent-456',
    operator: 'operator-789',
    assigned_by: 'trader-abc',
    timestamp_unix: 1743724800,
    execution: {
      tx_signatures: ['5Kj8xVmN3...'],
      programs_called: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
      instructions_executed: ['swap'],
      token_transfers: [
        { mint: 'EPjFWdd5...', amount: 1000000, direction: 'out' },
      ],
    },
    result: {
      status: 'success',
      summary: 'Swapped 1 USDC for 0.00523 SOL',
    },
  };

  const mockReceiptEntity: ReceiptEntity = {
    id: 1,
    agentId: 'agent-456',
    taskId: 'task-123',
    outputHash: 'abc123hash',
    timestamp: 1743724800,
    cid: 'arweave-cid-xyz',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReceiptService = {
    create: jest.fn(),
    findByTaskId: jest.fn(),
    findByAgentId: jest.fn(),
    updateCid: jest.fn(),
    verifyCid: jest.fn(),
  };

  const mockIpfsService = {
    computeOutputHash: jest.fn(),
    pinReceiptToIpfs: jest.fn(),
    retrieveReceipt: jest.fn(),
    verifyReceipt: jest.fn(),
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptController],
      providers: [
        {
          provide: ReceiptService,
          useValue: mockReceiptService,
        },
        {
          provide: ReceiptIpfsService,
          useValue: mockIpfsService,
        },
      ],
    }).compile();

    controller = module.get<ReceiptController>(ReceiptController);
    receiptService = module.get<ReceiptService>(ReceiptService);
    ipfsService = module.get<ReceiptIpfsService>(ReceiptIpfsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadReceipt', () => {
    it('should upload receipt and return response', async () => {
      const outputHash = 'computed-hash-123';
      const cid = 'arweave-tx-id-abc';

      mockIpfsService.computeOutputHash.mockReturnValue(outputHash);
      mockIpfsService.pinReceiptToIpfs.mockResolvedValue(cid);
      mockReceiptService.create.mockResolvedValue(mockReceiptEntity);
      mockReceiptService.updateCid.mockResolvedValue({
        ...mockReceiptEntity,
        cid,
      });

      const result = await controller.uploadReceipt(mockExecutionReceipt);

      expect(result).toEqual({
        cid,
        taskId: mockExecutionReceipt.task_id,
        agentId: mockExecutionReceipt.agent_id,
        outputHash,
      });

      expect(mockIpfsService.computeOutputHash).toHaveBeenCalledWith(
        mockExecutionReceipt,
      );
      expect(mockIpfsService.pinReceiptToIpfs).toHaveBeenCalledWith(
        mockExecutionReceipt,
      );
      expect(mockReceiptService.create).toHaveBeenCalledWith({
        agentId: mockExecutionReceipt.agent_id,
        taskId: mockExecutionReceipt.task_id,
        outputHash,
        timestamp: mockExecutionReceipt.timestamp_unix,
      });
      expect(mockReceiptService.updateCid).toHaveBeenCalledWith(
        mockReceiptEntity.taskId,
        cid,
      );
    });

    it('should throw BAD_REQUEST when missing required fields', async () => {
      const incompleteReceipt = {
        schema_version: '1.0',
        task_id: 'task-123',
        // Missing agent_id and timestamp_unix
      } as ExecutionReceipt;

      await expect(controller.uploadReceipt(incompleteReceipt)).rejects.toThrow(
        new HttpException(
          'Missing required fields in execution receipt',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw INTERNAL_SERVER_ERROR on upload failure', async () => {
      mockIpfsService.computeOutputHash.mockReturnValue('hash');
      mockIpfsService.pinReceiptToIpfs.mockRejectedValue(
        new Error('Arweave network error'),
      );

      await expect(
        controller.uploadReceipt(mockExecutionReceipt),
      ).rejects.toThrow(HttpException);

      try {
        await controller.uploadReceipt(mockExecutionReceipt);
      } catch (error) {
        expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('getReceipt', () => {
    it('should retrieve full receipt from Arweave', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(mockReceiptEntity);
      mockIpfsService.retrieveReceipt.mockResolvedValue(mockExecutionReceipt);
      mockIpfsService.verifyReceipt.mockResolvedValue(true);

      const result = await controller.getReceipt('task-123');

      expect(result).toEqual(mockExecutionReceipt);
      expect(mockReceiptService.findByTaskId).toHaveBeenCalledWith('task-123');
      expect(mockIpfsService.retrieveReceipt).toHaveBeenCalledWith(
        mockReceiptEntity.cid,
      );
      expect(mockIpfsService.verifyReceipt).toHaveBeenCalledWith(
        mockReceiptEntity.cid,
        mockReceiptEntity.outputHash,
      );
    });

    it('should throw NOT_FOUND when receipt does not exist', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(null);

      await expect(controller.getReceipt('nonexistent-task')).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getReceipt('nonexistent-task');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.NOT_FOUND);
        expect(error.message).toContain('Receipt not found');
      }
    });

    it('should throw NOT_FOUND when receipt has no CID', async () => {
      const receiptWithoutCid = { ...mockReceiptEntity, cid: undefined };
      mockReceiptService.findByTaskId.mockResolvedValue(receiptWithoutCid);

      await expect(controller.getReceipt('task-123')).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getReceipt('task-123');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw INTERNAL_SERVER_ERROR on Arweave retrieval failure', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(mockReceiptEntity);
      mockIpfsService.retrieveReceipt.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(controller.getReceipt('task-123')).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getReceipt('task-123');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Failed to retrieve receipt');
      }
    });
  });

  describe('getReceiptsByAgent', () => {
    it('should return all receipts for an agent', async () => {
      const receipts = [
        mockReceiptEntity,
        { ...mockReceiptEntity, id: 2, taskId: 'task-789' },
      ];

      mockReceiptService.findByAgentId.mockResolvedValue(receipts);

      const result = await controller.getReceiptsByAgent('agent-456');

      expect(result).toEqual(receipts);
      expect(mockReceiptService.findByAgentId).toHaveBeenCalledWith(
        'agent-456',
      );
    });

    it('should throw NOT_FOUND when agent has no receipts', async () => {
      mockReceiptService.findByAgentId.mockResolvedValue([]);

      await expect(
        controller.getReceiptsByAgent('unknown-agent'),
      ).rejects.toThrow(HttpException);

      try {
        await controller.getReceiptsByAgent('unknown-agent');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.NOT_FOUND);
        expect(error.message).toContain('No receipts found');
      }
    });

    it('should throw NOT_FOUND when result is null', async () => {
      mockReceiptService.findByAgentId.mockResolvedValue(null);

      await expect(
        controller.getReceiptsByAgent('unknown-agent'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('verifyReceipt', () => {
    it('should verify receipt successfully', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(mockReceiptEntity);
      mockIpfsService.verifyReceipt.mockResolvedValue(true);

      const result = await controller.verifyReceipt('task-123');

      expect(result).toEqual({
        taskId: 'task-123',
        cid: mockReceiptEntity.cid,
        verified: true,
        outputHash: mockReceiptEntity.outputHash,
      });

      expect(mockIpfsService.verifyReceipt).toHaveBeenCalledWith(
        mockReceiptEntity.cid,
        mockReceiptEntity.outputHash,
      );
    });

    it('should return verified: false for hash mismatch', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(mockReceiptEntity);
      mockIpfsService.verifyReceipt.mockResolvedValue(false);

      const result = await controller.verifyReceipt('task-123');

      expect(result.verified).toBe(false);
    });

    it('should throw NOT_FOUND when receipt does not exist', async () => {
      mockReceiptService.findByTaskId.mockResolvedValue(null);

      await expect(
        controller.verifyReceipt('nonexistent-task'),
      ).rejects.toThrow(HttpException);

      try {
        await controller.verifyReceipt('nonexistent-task');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw NOT_FOUND when receipt has no CID', async () => {
      const receiptWithoutCid = { ...mockReceiptEntity, cid: undefined };
      mockReceiptService.findByTaskId.mockResolvedValue(receiptWithoutCid);

      await expect(controller.verifyReceipt('task-123')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
