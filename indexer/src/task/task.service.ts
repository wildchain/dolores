import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, TaskStatus } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { CompleteTaskDto, UpdateTaskStatusDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);

    constructor(
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
    ) { }


    async create(dto: CreateTaskDto): Promise<TaskEntity> {
        const task = this.taskRepository.create({
            taskId: dto.taskId,
            agentId: dto.agentId,
            assignedBy: dto.assignedBy,
            instruction: dto.instruction,
            deadline: dto.deadline,
            onChainCreatedAt: dto.onChainCreatedAt,
            status: TaskStatus.Pending,
        });
        return this.taskRepository.save(task);
    }

    // Called by the agent runtime after complete_task() lands on-chain.
    async markCompleted(taskId: string, dto: CompleteTaskDto): Promise<TaskEntity | null> {
        const task = await this.findByTaskId(taskId);
        if (!task) return null;

        task.status = TaskStatus.Completed;
        task.outputHash = dto.outputHash;
        task.completedAt = dto.completedAt;
        if (dto.arweaveCid) task.arweaveCid = dto.arweaveCid;
        if (dto.attestationTx) task.attestationTx = dto.attestationTx;

        return this.taskRepository.save(task);
    }

    // Generic status update — used when indexer catches challenge/slash/dismiss events.
    async updateStatus(taskId: string, dto: UpdateTaskStatusDto): Promise<TaskEntity | null> {
        const task = await this.findByTaskId(taskId);
        if (!task) return null;

        task.status = dto.status;
        if (dto.outputHash) task.outputHash = dto.outputHash;
        if (dto.completedAt) task.completedAt = dto.completedAt;
        if (dto.arweaveCid) task.arweaveCid = dto.arweaveCid;
        if (dto.attestationTx) task.attestationTx = dto.attestationTx;

        return this.taskRepository.save(task);
    }

    async updateArweaveCid(taskId: string, cid: string): Promise<TaskEntity | null> {
        const task = await this.findByTaskId(taskId);
        if (!task) return null;
        task.arweaveCid = cid;
        return this.taskRepository.save(task);
    }


    async findByTaskId(taskId: string): Promise<TaskEntity | null> {
        return this.taskRepository.findOne({ where: { taskId } });
    }

    // Primary query for the agent runtime polling loop:
    // "give me all pending tasks assigned to my pubkey"
    async findPendingByAgent(agentId: string): Promise<TaskEntity[]> {
        return this.taskRepository.find({
            where: { agentId, status: TaskStatus.Pending },
            order: { deadline: 'ASC' }, // most urgent first
        });
    }

    // All tasks for an agent — used by frontend Task Panel
    async findByAgent(agentId: string): Promise<TaskEntity[]> {
        return this.taskRepository.find({
            where: { agentId },
            order: { onChainCreatedAt: 'DESC' },
        });
    }

    // All tasks assigned by an operator/user — used by frontend Dashboard
    async findByAssignedBy(assignedBy: string): Promise<TaskEntity[]> {
        return this.taskRepository.find({
            where: { assignedBy },
            order: { onChainCreatedAt: 'DESC' },
        });
    }

    // All tasks with a given status — useful for monitoring
    async findByStatus(status: TaskStatus): Promise<TaskEntity[]> {
        return this.taskRepository.find({
            where: { status },
            order: { deadline: 'ASC' },
        });
    }

    // Tasks approaching deadline with no completion — for challenge detection
    async findOverdue(nowUnix: number): Promise<TaskEntity[]> {
        return this.taskRepository
            .createQueryBuilder('task')
            .where('task.status = :status', { status: TaskStatus.Pending })
            .andWhere('task.deadline < :now', { now: nowUnix })
            .orderBy('task.deadline', 'ASC')
            .getMany();
    }
}