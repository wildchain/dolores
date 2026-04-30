import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
  constructor(private agentsService: AgentsService) { }

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

  @Get('marketplace')
  async getMarketplace(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<AgentListItemDto[]> {
    return this.agentsService.getMarketplace(Math.min(limit, 100), offset);
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



  @Post(':id/list-for-hire')
  async listForHire(
    @Param('id') agentId: string,
    @Body() body: { hireFeeSOL: number; available: boolean },
  ): Promise<{ ok: boolean }> {
    await this.agentsService.setAvailableForHire(agentId, body.available, body.hireFeeSOL ?? 0.01);
    return { ok: true };
  }

  @Post(':id/build-hire-tx')
  async buildHireTx(
    @Param('id') agentId: string,
    @Body() body: { payerWallet: string; operatorId: string },
  ): Promise<{ transaction: string; message: string }> {
    return this.agentsService.buildHireTx(agentId, body.payerWallet, body.operatorId);
  }
}
