import { BaseEntity } from '@dolores/lib/database/base.entity';
import { Entity } from 'typeorm';

@Entity('agents')
export class AgentEntity extends BaseEntity {}
