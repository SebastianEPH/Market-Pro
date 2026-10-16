import { inject, injectable } from 'inversify';
import { CoreToken, Database, NotFoundError } from '@market-pro/core';
import { ModuleCode, ModuleView } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { ICatalogRepository } from '../repositories/catalog.repository.js';

/** Catálogo global de módulos / permisos / features (administrador de plataforma). */
@injectable()
export class ModuleService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(IdentityToken.CatalogRepository) private readonly catalog: ICatalogRepository,
  ) {}

  list(): Promise<ModuleView[]> {
    return this.db.withGlobal((tx) => this.catalog.listModules(tx));
  }

  /** Interruptor global: apaga/enciende un módulo para TODAS las tiendas. */
  async setActive(code: ModuleCode, isActive: boolean): Promise<ModuleView[]> {
    const updated = await this.db.withGlobal((tx) => this.catalog.setModuleActive(tx, code, isActive));
    if (!updated) throw new NotFoundError('Módulo');
    return this.list();
  }
}
