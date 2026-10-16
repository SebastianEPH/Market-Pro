import { Switch } from '@market-pro/frontend-common';
import { FeatureValueType, FeatureView, TenantFeatureConfig } from '@market-pro/shared';

export function defaultFeatureConfigs(features: FeatureView[]): TenantFeatureConfig[] {
  return features.map((feature) => ({
    featureCode: feature.code,
    isEnabled: feature.defaultEnabled,
    limit: feature.defaultLimit,
  }));
}

/** Características on/off y límites numéricos (ej. máximo de usuarios). */
export function TenantFeaturesEditor({
  features,
  value,
  onChange,
}: {
  features: FeatureView[];
  value: TenantFeatureConfig[];
  onChange(next: TenantFeatureConfig[]): void;
}) {
  const byCode = new Map(value.map((config) => [config.featureCode, config]));

  const update = (feature: FeatureView, patch: Partial<TenantFeatureConfig>) => {
    const current = byCode.get(feature.code) ?? {
      featureCode: feature.code,
      isEnabled: feature.defaultEnabled,
      limit: feature.defaultLimit,
    };
    onChange([...value.filter((config) => config.featureCode !== feature.code), { ...current, ...patch }]);
  };

  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Característica</th>
            <th>Habilitada</th>
            <th>Límite</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => {
            const config = byCode.get(feature.code);
            const enabled = config?.isEnabled ?? feature.defaultEnabled;
            return (
              <tr key={feature.code}>
                <td>
                  <strong>{feature.name}</strong>
                  <div className="muted">{feature.description}</div>
                  <code className="muted">{feature.code}</code>
                </td>
                <td>
                  <Switch checked={enabled} onChange={(checked) => update(feature, { isEnabled: checked })} />
                </td>
                <td style={{ maxWidth: 140 }}>
                  {feature.valueType === FeatureValueType.NUMBER ? (
                    <input
                      type="number"
                      min={0}
                      disabled={!enabled}
                      placeholder="Sin límite"
                      value={config?.limit ?? ''}
                      onChange={(event) => update(feature, { limit: event.target.value === '' ? null : Number(event.target.value) })}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
