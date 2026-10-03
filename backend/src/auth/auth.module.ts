import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { GoogleService } from './google.service';
import { LoginService } from './login.service';
import { TokensService } from './tokens.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [TokensService, LoginService, GoogleService, AuthGuard],
  exports: [TokensService, AuthGuard],
})
export class AuthModule {}
