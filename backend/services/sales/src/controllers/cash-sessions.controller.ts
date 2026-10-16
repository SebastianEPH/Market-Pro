import { inject, injectable } from 'inversify';
import {
  ApiRequest,
  ApiResponse,
  Body,
  Controller,
  Get,
  HttpResult,
  Permission,
  Post,
  Query,
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { SalesToken } from '../sales-token.enum.js';
import {
  CashSessionListQuery,
  CloseCashSessionDto,
  OpenCashSessionDto,
  cashSessionListQuerySchema,
  closeCashSessionSchema,
  openCashSessionSchema,
} from '../schemas/sales.schemas.js';
import { CashSessionService } from '../services/cash-session.service.js';

@injectable()
@Controller('/cash-sessions', RouteScope.TENANT)
export class CashSessionsController {
  constructor(@inject(SalesToken.CashSessionService) private readonly sessions: CashSessionService) {}

  /** Caja abierta del usuario actual (null si no tiene). */
  @Get('/current')
  @Permission(ModuleCode.CASH_REGISTER, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  async current(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.sessions.current(request.tenantId, request.userId));
  }

  @Get()
  @Permission(ModuleCode.CASH_REGISTER, PermissionAction.READ)
  @Query(cashSessionListQuerySchema)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.sessions.list(request.tenantId, request.getQuery<CashSessionListQuery>()));
  }

  @Post('/open')
  @Permission(ModuleCode.CASH_REGISTER, PermissionAction.CREATE)
  @Body(openCashSessionSchema)
  async open(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(
      await this.sessions.open(request.tenantId, request.requirePrincipal(), request.getBody<OpenCashSessionDto>()),
    );
  }

  @Get('/{id}')
  @Permission(ModuleCode.CASH_REGISTER, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.sessions.get(request.tenantId, request.param('id')));
  }

  @Post('/{id}/close')
  @Permission(ModuleCode.CASH_REGISTER, PermissionAction.UPDATE)
  @Body(closeCashSessionSchema)
  async close(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.sessions.close(request.requireAccess(), request.param('id'), request.getBody<CloseCashSessionDto>()),
    );
  }
}
