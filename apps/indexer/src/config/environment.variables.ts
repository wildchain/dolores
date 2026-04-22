import {
  IsIn,
  IsNotEmpty,
  IsPort,
  IsString,
  validateSync,
} from 'class-validator';

export type Environment = 'development' | 'staging' | 'production';

export interface IEnvironmentVariables {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  DATABASE_SCHEMA: string;
}

export class EnvironmentVariables implements IEnvironmentVariables {
  @IsIn(['development', 'staging', 'production'])
  APPLICATION_ENV: Environment;
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;
  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string;
  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;
  @IsPort()
  DATABASE_PORT: number;
  @IsString()
  @IsNotEmpty()
  DATABASE_SCHEMA: string;
  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string;

  constructor(env: Record<string, string | undefined>) {
    Object.assign(this, env);
  }
}

export async function initializeEnvironment() {
  try {
    const environmentVariables = new EnvironmentVariables(process.env);
    const errors = validateSync(environmentVariables);
    if (errors.length > 0) {
      console.log(JSON.stringify(errors, null, 2));
      process.exit(1);
    }
    return environmentVariables;
  } catch (error) {
    console.error('Error initializing environment variables:', error);
    throw error;
  }
}
