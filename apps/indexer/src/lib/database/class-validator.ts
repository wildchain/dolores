import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsPositive,
  IsUrl,
  ValidateIf,
  ValidationError,
  ValidationOptions,
} from 'class-validator';

export const formatErrorMessage = (errors: ValidationError[]): string[] => {
  const errorMessages: string[] = [];
  errors.forEach((error) => {
    const messagesPerField = Object.values(
      error.constraints as Record<string, string>,
    );
    messagesPerField.forEach((message) => errorMessages.push(message));
  });
  return errorMessages;
};

export const ValidateIfNotUndefined = () =>
  ValidateIf((_, value) => value !== undefined);

export const IsDeclutterFileUrl = (validationOptions?: ValidationOptions) =>
  IsUrl(
    {
      protocols: ['https'],
      // host_whitelist: ['nyc3.digitaloceanspaces.com'],
    },
    validationOptions,
  );

export const IsRouteParamId = () => {
  return function () {
    IsNotEmpty();
    IsPositive();
    Type(() => Number);
  };
};
