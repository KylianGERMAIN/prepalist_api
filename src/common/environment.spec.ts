import { isProduction } from './environment';

describe('isProduction', () => {
  it('recognises the canonical value', () => {
    expect(isProduction('production')).toBe(true);
  });

  it('recognises a value typed by hand, which would otherwise reopen docs and CORS', () => {
    expect(isProduction('Production')).toBe(true);
    expect(isProduction('PRODUCTION')).toBe(true);
    expect(isProduction(' production ')).toBe(true);
  });

  it('rejects anything else, including a truncated form', () => {
    expect(isProduction('prod')).toBe(false);
    expect(isProduction('local')).toBe(false);
    expect(isProduction('')).toBe(false);
    expect(isProduction(undefined)).toBe(false);
  });
});
