/**
 * Identificadores de inyección del núcleo. Inversify acepta strings como
 * ServiceIdentifier, así que usamos enums en lugar de Symbols sueltos.
 */
export enum CoreToken {
  Config = 'core.Config',
  Logger = 'core.Logger',
  Database = 'core.Database',
  TokenService = 'core.TokenService',
  ServiceTransport = 'core.ServiceTransport',
  ServiceClient = 'core.ServiceClient',
  AccessResolver = 'core.AccessResolver',
}
