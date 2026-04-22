import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskEntity, TaskStatus } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { CompleteTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TaskController {
    constructor(private readonly taskService: TaskService) { }


    // Called by the dolores-agent runtime (or indexer event listener)
    // when it detects a new TaskRegistered event on-chain.
    //
    // Body: CreateTaskDto
    @Post()
    async createTask(@Body() dto: CreateTaskDto): Promise<TaskEntity> {
        // Idempotent — if task already exists return it instead of throwing
        const existing = await this.taskService.findByTaskId(dto.taskId);
        if (existing) return existing;

        return this.taskService.create(dto);
    }


    // Single task lookup by on-chain task_id (hex string).
    @Get(':taskId')
    async getTask(@Param('taskId') taskId: string): Promise<TaskEntity> {
        const task = await this.taskService.findByTaskId(taskId);
        if (!task) {
            throw new HttpException(
                `Task ${taskId} not found`,
                HttpStatus.NOT_FOUND,
            );
        }
        return task;
    }


    // All tasks for an agent — used by frontend Task Panel.
    @Get('agent/:agentId')
    async getTasksByAgent(@Param('agentId') agentId: string): Promise<TaskEntity[]> {
        return this.taskService.findByAgent(agentId);
    }


    // PRIMARY POLLING ENDPOINT for the agent runtime.
    // Returns only Pending tasks, ordered by deadline ASC (most urgent first).
    //
    // dolores-agent polls this every 3s:
    //   GET /tasks/agent/<agentPubkey>/pending
    @Get('agent/:agentId/pending')
    async getPendingTasksByAgent(
        @Param('agentId') agentId: string,
    ): Promise<TaskEntity[]> {
        return this.taskService.findPendingByAgent(agentId);
    }

    // All tasks assigned by an operator or user — used by Dashboard.
    @Get('assigned-by/:assignedBy')
    async getTasksByAssignedBy(
        @Param('assignedBy') assignedBy: string,
    ): Promise<TaskEntity[]> {
        return this.taskService.findByAssignedBy(assignedBy);
    }

    // Called by dolores-agent after complete_task() lands on-chain.
    // Body: CompleteTaskDto
    @Patch(':taskId/complete')
    async completeTask(
        @Param('taskId') taskId: string,
        @Body() dto: CompleteTaskDto,
    ): Promise<TaskEntity> {
        const task = await this.taskService.markCompleted(taskId, dto);
        if (!task) {
            throw new HttpException(
                `Task ${taskId} not found`,
                HttpStatus.NOT_FOUND,
            );
        }
        return task;
    }

    // Called by the indexer event listener when it catches
    // ChallengeFiledEvent, AgentSlashedEvent, ChallengeDismissedEvent.
    // Body: { status: TaskStatus }
    @Patch(':taskId/status')
    async updateStatus(
        @Param('taskId') taskId: string,
        @Body() dto: { status: TaskStatus },
    ): Promise<TaskEntity> {
        const validStatuses = Object.values(TaskStatus);
        if (!validStatuses.includes(dto.status)) {
            throw new HttpException(
                `Invalid status: ${dto.status}. Valid values: ${validStatuses.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const task = await this.taskService.updateStatus(taskId, { status: dto.status });
        if (!task) {
            throw new HttpException(
                `Task ${taskId} not found`,
                HttpStatus.NOT_FOUND,
            );
        }
        return task;
    }
}