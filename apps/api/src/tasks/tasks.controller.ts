import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Patch
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  TaskListItemDto,
  TaskDetailsDto,
  TaskStatus,
  BuildRegisterTaskDto,
  UnsignedTransactionDto,
} from '@dolores/shared';

@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) { }

  @Get()
  async getTasks(
    @Query('agentId') agentId?: string,
    @Query('requester') requester?: string,
    @Query('status') status?: TaskStatus,
    @Query('capabilityName') capabilityName?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<TaskListItemDto[]> {
    return this.tasksService.getTasks({ agentId, requester, status, capabilityName, limit, offset });
  }

  // Must come before :id to avoid route shadowing
  @Get('agent/:id/pending')
  async getPendingTasksForAgent(@Param('id') agentId: string): Promise<any[]> {
    const tasks = await this.tasksService.getTasks({ agentId, status: TaskStatus.PENDING });
    return tasks.map((t) => ({
      taskId: t.taskId,
      agentId: t.agentId,
      assignedBy: t.requester,
      instruction: t.capabilityName,
      deadline: (t as any).deadline ?? 0,
      onChainCreatedAt: t.createdAt,
      status: t.status,
    }));
  }

  @Get(':id')
  async getTaskDetails(@Param('id') taskId: string): Promise<TaskDetailsDto> {
    return this.tasksService.getTaskDetails(taskId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async seedTask(
    @Body() body: { taskId: string; agentId: string; assignedBy: string; instruction: string; deadline: number; onChainCreatedAt: number },
  ): Promise<{ ok: boolean }> {
    await this.tasksService.cacheTask({
      taskId: body.taskId,
      agentId: body.agentId,
      agentName: body.agentId.slice(0, 8) + '...',
      requester: body.assignedBy,
      status: 'pending',
      capabilityName: body.instruction,
      parametersJson: JSON.stringify({ instruction: body.instruction }),
      challengePda: '',
      stakeAmount: 0,
      createdAt: body.onChainCreatedAt,
      deadline: body.deadline,
    } as any);
    return { ok: true };
  }


  @Post('build-register')
  async buildRegisterTask(
    @Body() body: BuildRegisterTaskDto & { wallet: string },
  ): Promise<UnsignedTransactionDto> {
    return this.tasksService.buildRegisterTask(body, body.wallet);
  }


  @Patch(':id')
  async updateTaskStatus(
    @Param('id') taskId: string,
    @Body() body: { status: string },
  ): Promise<{ ok: boolean }> {
    const allTasks = await this.tasksService.getTasks({});
    const task = allTasks.find(t => t.taskId === taskId);
    if (task) {
      await this.tasksService.updateTaskStatus(task.agentId, taskId, body.status as any);
    }
    return { ok: true };
  }
}