import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @Length(8, 128, { message: 'password must be 8 to 128 characters' }) password: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @Length(1, 128) password: string;
  @IsIn(['web', 'extension']) client: 'web' | 'extension';
  @IsOptional() @IsString() @Length(1, 60) deviceName?: string;
}

export class ChangePasswordDto {
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;
  @IsString() @Length(8, 128, { message: 'new password must be 8 to 128 characters' }) newPassword: string;
}

export class RefreshDto {
  @IsOptional() @IsString() @MaxLength(200) refreshToken?: string;
}

export class ExtensionTokenDto {
  @IsString() @Length(43, 43) code: string;
  @Matches(/^[A-Za-z0-9\-._~]{43,128}$/) codeVerifier: string;
  @IsOptional() @IsString() @Length(1, 60) deviceName?: string;
}

export class GoogleStartQuery {
  @IsIn(['web', 'extension']) client: 'web' | 'extension';
  @IsOptional() @IsString() @MaxLength(200) redirect_uri?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{43}$/) code_challenge?: string;
}
