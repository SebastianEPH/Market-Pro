import 'reflect-metadata';
import { LambdaApplication } from '@market-pro/core';
import { createIdentityContainer } from './container.js';
import { AuthController } from './controllers/auth.controller.js';
import { InternalController } from './controllers/internal.controller.js';
import { PlatformModulesController } from './controllers/platform-modules.controller.js';
import { PlatformTenantsController } from './controllers/platform-tenants.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { SettingsController } from './controllers/settings.controller.js';
import { UsersController } from './controllers/users.controller.js';

/**
 * Entrada Lambda del microservicio identity.
 * El contenedor y el pool de BD se crean una vez por cold start.
 * AWS: handler = dist/handler.handler, ruta API Gateway `ANY /identity/{proxy+}`.
 */
const app = new LambdaApplication(createIdentityContainer(), {
  controllers: [
    AuthController,
    PlatformTenantsController,
    PlatformModulesController,
    UsersController,
    RolesController,
    SettingsController,
    InternalController,
  ],
});

export const handler = app.handler;
