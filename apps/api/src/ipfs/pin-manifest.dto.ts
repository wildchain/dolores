import { IsNotEmpty, IsObject } from 'class-validator';

export class PinManifestDto {
  @IsObject()
  @IsNotEmpty()
  manifest: Record<string, unknown>;
}
