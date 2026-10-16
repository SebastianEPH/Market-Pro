import { inject, injectable } from 'inversify';
import { ApiRequest, ApiResponse, Body, Controller, Get, HttpResult, Post, Public, RouteScope } from '@market-pro/core';
import { IdentityToken } from '../identity-token.enum.js';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  changePasswordSchema,
  loginSchema,
  refreshSchema,
} from '../schemas/identity.schemas.js';
import { AuthService, ClientMeta } from '../services/auth.service.js';

function clientMeta(request: ApiRequest): ClientMeta {
  return { userAgent: request.header('user-agent'), ipAddress: request.sourceIp };
}

@injectable()
@Controller('/auth', RouteScope.AUTHENTICATED)
export class AuthController {
  constructor(@inject(IdentityToken.AuthService) private readonly auth: AuthService) {}

  /** Login de plataforma (sin tenantSlug) o de tienda (con tenantSlug). */
  @Post('/login')
  @Public()
  @Body(loginSchema)
  async login(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.auth.login(request.getBody<LoginDto>(), clientMeta(request)));
  }

  @Post('/refresh')
  @Public()
  @Body(refreshSchema)
  async refresh(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.auth.refresh(request.getBody<RefreshDto>().refreshToken, clientMeta(request)));
  }

  @Post('/logout')
  @Public()
  @Body(refreshSchema)
  async logout(request: ApiRequest): Promise<HttpResult> {
    await this.auth.logout(request.getBody<RefreshDto>().refreshToken);
    return ApiResponse.noContent();
  }

  /** Perfil + permisos efectivos en tiempo real (los frontends lo consultan periódicamente). */
  @Get('/me')
  async me(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.auth.me(request.requirePrincipal()));
  }

  @Post('/change-password')
  @Body(changePasswordSchema)
  async changePassword(request: ApiRequest): Promise<HttpResult> {
    await this.auth.changePassword(request.requirePrincipal(), request.getBody<ChangePasswordDto>());
    return ApiResponse.noContent();
  }
}
