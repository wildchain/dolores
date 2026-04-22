import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTasksTable1714000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'tasks',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'created_at',
                        type: 'timestamptz',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamptz',
                        default: 'now()',
                    },
                    {
                        name: 'task_id',
                        type: 'varchar',
                        isUnique: true,
                    },
                    {
                        name: 'agent_id',
                        type: 'varchar',
                    },
                    {
                        name: 'assigned_by',
                        type: 'varchar',
                    },
                    {
                        name: 'instruction',
                        type: 'varchar',
                        length: '256',
                    },
                    {
                        name: 'output_hash',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        default: "'pending'",
                    },
                    {
                        name: 'deadline',
                        type: 'bigint',
                    },
                    {
                        name: 'on_chain_created_at',
                        type: 'bigint',
                    },
                    {
                        name: 'completed_at',
                        type: 'bigint',
                        isNullable: true,
                    },
                    {
                        name: 'arweave_cid',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'attestation_tx',
                        type: 'varchar',
                        isNullable: true,
                    },
                ],
                indices: [
                    // Agent runtime polls this constantly — must be fast
                    { columnNames: ['agent_id', 'status'] },
                    { columnNames: ['assigned_by'] },
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('tasks');
    }
}