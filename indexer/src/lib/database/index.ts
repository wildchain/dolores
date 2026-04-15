import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ColumnType, DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { ENTITIES } from '@dolores/lib/database/entities';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@dolores/config/environment.variables';

config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

export const DATASOURCE_OPTIONS: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  entities: ENTITIES as any,
  schema: process.env.DATABASE_SCHEMA,
  migrations: [],
  ssl: process.env.APPLICATION_ENV !== 'development',
  synchronize: false,
};

export const CustomDataSource = (options: DataSourceOptions): DataSource => {
  const dataSource = new DataSource(options);
  dataSource.driver.supportedDataTypes.push('vector' as ColumnType);
  dataSource.driver.withLengthColumnTypes.push('vector' as ColumnType);
  return dataSource;
};

export const DATABASE_CONFIG: TypeOrmModuleAsyncOptions = {
  useFactory: (configService: ConfigService<EnvironmentVariables>) => {
    console.log(
      process.env.APPLICATION_ENV === 'production'
        ? 'mmw_ai_production'
        : 'mmw_ai_staging',
    );
    return {
      type: 'postgres',
      host: configService.get('DATABASE_HOST'),
      username: configService.get('DATABASE_USER'),
      password: configService.get('DATABASE_PASSWORD'),
      synchronize: false,
      migrations: [],
      database: configService.get('DATABASE_NAME'),
      entities: ENTITIES,
      schema: 'dolores',
      port: 5432,
      ssl: process.env.APPLICATION_ENV !== 'development',
    };
  },
  inject: [ConfigService],
  dataSourceFactory: async (options) => {
    return CustomDataSource(options as any);
  },
};

export default CustomDataSource(DATASOURCE_OPTIONS);
