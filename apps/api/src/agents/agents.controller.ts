import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import {
  AgentListItemDto,
  AgentDetailsDto,
  AgentTaskDto,
} from '@dolores/shared';

@Controller('agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  /**
   * GET /agents - List all agents with pagination
   */
  @Get()
  async getAgents(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<AgentListItemDto[]> {
    // Enforce max limit
    const safeLimit = Math.min(limit, 100);
    return this.agentsService.getAgents(safeLimit, offset);
  }

  /**
   * GET /agents/operator/:address - Get agents by operator wallet
   */
  @Get('operator/:address')
  async getAgentsByOperator(
    @Param('address') address: string,
  ): Promise<AgentListItemDto[]> {
    return this.agentsService.getAgentsByOperator(address);
  }

  /**
   * GET /agents/:id - Get agent details
   */
  @Get(':id')
  async getAgentDetails(
    @Param('id') agentId: string,
  ): Promise<AgentDetailsDto> {
    return this.agentsService.getAgentDetails(agentId);
  }

  /**
   * GET /agents/:id/tasks - Get agent's tasks
   */
  @Get(':id/tasks')
  async getAgentTasks(
    @Param('id') agentId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<AgentTaskDto[]> {
    const safeLimit = Math.min(limit, 100);
    return this.agentsService.getAgentTasks(agentId, safeLimit, offset);
  }
}
