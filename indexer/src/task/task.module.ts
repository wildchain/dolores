import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskEntity } from './task.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([TaskEntity]),
    ],
    controllers: [TaskController],
    providers: [TaskService],
    exports: [TaskService], // exported so AttestationService or future modules can use it
})
export class TaskModule { }