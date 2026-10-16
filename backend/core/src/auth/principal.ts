import { AuthScope } from '@market-pro/shared';

/** Identidad autenticada extraída del JWT. */
export interface Principal {
  subjectId: string;
  scope: AuthScope;
  tenantId: string | null;
  email: string;
  name: string;
}
