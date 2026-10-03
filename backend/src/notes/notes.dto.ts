import { IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateNoteDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class UpdateNoteDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(16) icon?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>; // deep-validated by sanitizeNoteContent
}

export class MoveNoteDto {
  @ValidateIf((_, v) => v !== null) @IsUUID() parentId: string | null;
  @IsInt() @Min(0) @Max(100_000) position: number;
}
