import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptService } from './receipt.service';
import { ReceiptEntity } from './receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';

describe('ReceiptService', () => {
  let service: ReceiptService;
  let repository: Repository<ReceiptEntity>;

  const mockReceiptEntity: ReceiptEntity = {
    id: 1,
    agentId: 'agent-123',
    taskId: 'task-456',
    outputHash: 'abc123hash',
    timestamp: 1743724800,
    cid: 'arweave-cid-xyz',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ReceiptService>(ReceiptService);
    repository = module.get<Repository<ReceiptEntity>>(
      getRepositoryToken(ReceiptEntity),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a receipt', async () => {
      const dto: CreateReceiptDto = {
        agentId: 'agent-123',
        taskId: 'task-456',
        outputHash: 'abc123hash',
        timestamp: 1743724800,
      };

      const expectedReceipt = {
        ...dto,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(expectedReceipt);
      mockRepository.save.mockResolvedValue(expectedReceipt);

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalledWith(expectedReceipt);
      expect(result).toEqual(expectedReceipt);
    });
  });

  describe('findByTaskId', () => {
    it('should find receipt by task ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockReceiptEntity);

      const result = await service.findByTaskId('task-456');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: 'task-456' },
      });
      expect(result).toEqual(mockReceiptEntity);
    });

    it('should return null if receipt not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByTaskId('nonexistent-task');

      expect(result).toBeNull();
    });
  });

  describe('findByAgentId', () => {
    it('should find all receipts for an agent', async () => {
      const receipts = [
        mockReceiptEntity,
        { ...mockReceiptEntity, id: 2, taskId: 'task-789' },
      ];

      mockRepository.find.mockResolvedValue(receipts);

      const result = await service.findByAgentId('agent-123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
      });
      expect(result).toEqual(receipts);
    });

    it('should return empty array if no receipts found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findByAgentId('unknown-agent');

      expect(result).toEqual([]);
    });
  });

  describe('updateCid', () => {
    it('should update CID for existing receipt', async () => {
      const receipt = { ...mockReceiptEntity };
      mockRepository.findOne.mockResolvedValue(receipt);
      mockRepository.save.mockResolvedValue({
        ...receipt,
        cid: 'new-cid-abc',
      });

      const result = await service.updateCid('task-456', 'new-cid-abc');

      expect(result).toBeDefined();
      expect(result.cid).toBe('new-cid-abc');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null if receipt not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateCid('nonexistent-task', 'cid-123');

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyCid', () => {
    it('should return true when hash matches', async () => {
      mockRepository.findOne.mockResolvedValue(mockReceiptEntity);

      const result = await service.verifyCid('task-456', 'abc123hash');

      expect(result).toBe(true);
    });

    it('should return false when hash does not match', async () => {
      mockRepository.findOne.mockResolvedValue(mockReceiptEntity);

      const result = await service.verifyCid('task-456', 'wrong-hash');

      expect(result).toBe(false);
    });

    it('should return false when receipt not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyCid('nonexistent-task', 'any-hash');

      expect(result).toBe(false);
    });
  });
});
