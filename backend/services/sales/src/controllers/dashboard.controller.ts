import { inject, injectable } from 'inversify';
import { ApiRequest, ApiResponse, Controller, Get, HttpResult, Permission, RouteScope } from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { SalesToken } from '../sales-token.enum.js';
import { DashboardService } from '../services/dashboard.service.js';

@injectable()
@Controller('/dashboard', RouteScope.TENANT)
export class DashboardController {
  constructor(@inject(SalesToken.DashboardService) private readonly dashboard: DashboardService) {}

  @Get('/summary')
  @Permission(ModuleCode.DASHBOARD, PermissionAction.READ)
  async summary(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.dashboard.summary(request.requireAccess()));
  }
}
