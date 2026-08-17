import { resolveCorsOrigin } from './cors-origin';

describe('resolveCorsOrigin', () => {
  it('returns the explicit allowlist when CORS_ORIGINS is set', () => {
    expect(
      resolveCorsOrigin({
        corsOrigins: 'https://prepalist.app,https://www.prepalist.app',
        nodeEnv: 'production',
      }),
    ).toEqual(['https://prepalist.app', 'https://www.prepalist.app']);
  });

  it('trims entries and drops empty ones', () => {
    expect(
      resolveCorsOrigin({ corsOrigins: ' https://a.app , , https://b.app ' }),
    ).toEqual(['https://a.app', 'https://b.app']);
  });

  it('allows no origin at all when CORS_ORIGINS is missing in production', () => {
    expect(resolveCorsOrigin({ nodeEnv: 'production' })).toBe(false);
    expect(resolveCorsOrigin({ corsOrigins: '', nodeEnv: 'production' })).toBe(
      false,
    );
    // Une liste de séparateurs ne vaut pas une liste d'origines.
    expect(
      resolveCorsOrigin({ corsOrigins: ' , ', nodeEnv: 'production' }),
    ).toBe(false);
  });

  it('reflects the caller origin outside production, for local comfort', () => {
    expect(resolveCorsOrigin({ nodeEnv: 'local' })).toBe(true);
    expect(resolveCorsOrigin({})).toBe(true);
  });
});
