import { Tone } from '@market-pro/frontend-common';
import { TenantStatus } from '@market-pro/shared';

export function tenantTone(status: TenantStatus): Tone {
  switch (status) {
    case TenantStatus.ACTIVE:
      return Tone.SUCCESS;
    case TenantStatus.SUSPENDED:
      return Tone.WARNING;
    default:
      return Tone.DANGER;
  }
}
