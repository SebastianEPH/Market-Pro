import { inject, injectable } from 'inversify';
import { ApiRequest, ApiResponse, Body, Controller, HttpResult, Post, RouteScope } from '@market-pro/core';
import { IdentityToken } from '../identity-token.enum.js';
import { ResolveAccessDto, resolveAccessSchema } from '../schemas/identity.schemas.js';
import { AccessService } from '../services/access.service.js';

/** Endpoints solo para otros microservicios (cabecera x-internal-key). */
@injectable()
@Controller('/internal', RouteScope.INTERNAL)
export class InternalController {
  constructor(@inject(IdentityToken.AccessService) private readonly access: AccessService) {}

  @Post('/access/resolve')
  @Body(resolveAccessSchema)
  async resolveAccess(request: ApiRequest): Promise<HttpResult> {
    const dto = request.getBody<ResolveAccessDto>();
    return ApiResponse.ok(await this.access.resolveSubject(dto.scope, dto.subjectId, dto.tenantId));
  }
}
