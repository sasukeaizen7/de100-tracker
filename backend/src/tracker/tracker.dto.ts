import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(80) displayName?: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' }) startDate?: string;
}

export class SaveDayDto {
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class SaveProgressDto {
  @IsInt() @Min(0) @Max(100) percent: number;
}

export class SyncItemDto {
  @IsOptional() @IsInt() @IsPositive() udemyId?: number;
  @IsString() @Length(1, 300) title: string;
  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(100) percent: number;
}

export class SyncDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => SyncItemDto) items: SyncItemDto[];
}
