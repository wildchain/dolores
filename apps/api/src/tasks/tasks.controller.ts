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
  constructor(private tasksService: TasksService) {}

  /**
   * GET /tasks - Get filtered tasks with pagination
   */
  @Get()
  async getTasks(
    @Query('agentId') agentId?: string,
    @Query('requester') requester?: string,
    @Query('status') status?: TaskStatus,
    @Query('capabilityName') capabilityName?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<TaskListItemDto[]> {
    return this.tasksService.getTasks({
      agentId,
      requester,
      status,
      capabilityName,
      limit,
      offset,
    });
  }

  /**
   * GET /tasks/:id - Get task details
   */
  @Get(':id')
  async getTaskDetails(@Param('id') taskId: string): Promise<TaskDetailsDto> {
    return this.tasksService.getTaskDetails(taskId);
  }

  /**
   * POST /tasks/build-register - Build unsigned transaction for registering a task
   * Requires authentication
   */
  @Post('build-register')
  @UseGuards(AuthGuard)
  async buildRegisterTask(
    @Body() dto: BuildRegisterTaskDto,
    @Request() req: any,
  ): Promise<UnsignedTransactionDto> {
    const requesterWallet = req.user.wallet;
    return this.tasksService.buildRegisterTask(dto, requesterWallet);
  }
}
